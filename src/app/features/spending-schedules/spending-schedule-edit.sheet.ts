import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { map, switchMap } from 'rxjs';

import { SheetService } from '../../core/ui/sheet.service';
import { TelegramService } from '../../core/telegram/telegram.service';
import { ToastService } from '../../core/ui/toast.service';
import { SpendingApiService } from '../../domain/api/spending-api.service';
import { SpendingScheduleApiService } from '../../domain/api/spending-schedule-api.service';
import {
  Category,
  Currency,
  INTERVAL_UNITS,
  IntervalUnit,
  RecurrenceInput,
  RecurrenceKind,
  SpendingScheduleDetails,
  SpendingScheduleInput,
} from '../../domain/models/models';
import { CurrenciesStore } from '../../domain/stores/currencies.store';
import { UserSettingsStore } from '../../domain/stores/user-settings.store';
import {
  CategoryPickerData,
  CategoryPickerResult,
  CategoryPickerSheet,
} from '../../shared/ui/category-picker.sheet';
import {
  CurrencyPickerData,
  CurrencyPickerSheet,
} from '../../shared/ui/currency-picker.sheet';
import { DateInputComponent, dateFieldError } from '../../shared/ui/date-input.component';
import { IconComponent } from '../../shared/ui/icon.component';
import {
  TagPickerData,
  TagPickerResult,
  TagPickerSheet,
} from '../../shared/ui/tag-picker.sheet';
import { TimeInputComponent, timeFieldError } from '../../shared/ui/time-input.component';
import { categoryPath } from '../../shared/util/category-tree.util';
import { closeOnDismiss } from '../../shared/util/dismiss.util';
import {
  formatApiDate,
  parseApiDate,
  parseCalendarDate,
} from '../../shared/util/date.util';
import { parseAmount } from '../../shared/util/money.util';
import { intervalUnitLabel } from '../../shared/util/recurrence.util';
import { SwipeToCloseDirective } from '../../shared/util/swipe-to-close.directive';
import { DraftTag, DraftTags, draftTagKey } from '../../shared/util/tag-draft.util';

export interface SpendingScheduleEditData {
  /** null - создание нового расписания. */
  readonly schedule: SpendingScheduleDetails | null;
}

export interface SpendingScheduleEditResult {
  readonly kind: 'saved';
  readonly id: string;
}

/** Пауза перед предпросмотром, чтобы не дёргать сервер на каждую цифру. */
const PREVIEW_DEBOUNCE_MS = 350;

const MAX_INTERVAL_VALUE = 1000;

/**
 * Правка расписания: поля, разметка и правило.
 *
 * Всё, что человек меняет в листе, копится в его состоянии и уходит на сервер
 * по кнопке «Сохранить». Закрытие листа не применяет ничего.
 */
@Component({
  selector: 'app-spending-schedule-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DateInputComponent, IconComponent, SwipeToCloseDirective, TimeInputComponent],
  templateUrl: './spending-schedule-edit.sheet.html',
  styleUrl: './spending-schedule-edit.sheet.scss',
})
export class SpendingScheduleEditSheet implements OnDestroy {
  private readonly data = inject<SpendingScheduleEditData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<SpendingScheduleEditResult>>(DialogRef);
  private readonly api = inject(SpendingScheduleApiService);
  private readonly spendingApi = inject(SpendingApiService);
  private readonly sheets = inject(SheetService);
  private readonly telegram = inject(TelegramService);
  private readonly toast = inject(ToastService);
  private readonly currencies = inject(CurrenciesStore);
  private readonly settings = inject(UserSettingsStore);

  private readonly original = this.data.schedule;

  protected readonly isNew = this.original === null;

  protected readonly description = signal(this.original?.description ?? '');
  protected readonly amountText = signal(this.original ? String(this.original.amount) : '');
  // У нового расписания подставляется валюта сводки: иначе штатный путь
  // создания упирается в заблокированное «Сохранить» из-за пустого поля.
  protected readonly currencyId = signal(
    this.original?.currencyId ?? this.settings.viewCurrencyId(),
  );
  protected readonly category = signal<Category | null>(this.original?.category ?? null);
  protected readonly tags = new DraftTags(this.original?.tags ?? []);

  protected readonly tagKey = draftTagKey;

  protected readonly recurrenceKind = signal<RecurrenceKind>(
    this.original?.recurrenceKind ?? 'Interval',
  );
  protected readonly intervalValueText = signal(String(this.original?.intervalValue || 1));
  protected readonly intervalUnit = signal<IntervalUnit>(
    this.original?.intervalUnit ?? 'Month',
  );

  protected readonly startDateText = signal(toFieldValue(this.original?.startDate));
  protected readonly startTimeText = signal(this.original?.startTime ?? '10:00');
  protected readonly endDateText = signal(toFieldValue(this.original?.endDate));

  /**
   * Поля, которых пользователь уже касался.
   *
   * У нового расписания пустая форма невалидна вся сразу, и без этого экран
   * встречал бы тремя красными строками до первого нажатия.
   */
  protected readonly touchedDescription = signal(false);
  protected readonly touchedAmount = signal(false);
  protected readonly touchedStart = signal(false);
  protected readonly touchedCurrency = signal(false);

  protected readonly isSaving = signal(false);
  protected readonly preview = signal<readonly string[]>([]);
  protected readonly isPreviewLoading = signal(false);

  /** Предпросмотр не доехал: пустой список тут означал бы «дат не будет». */
  protected readonly previewFailed = signal(false);

  /** Все категории владельца: нужны, чтобы показать путь до выбранной. */
  private readonly allCategories = signal<readonly Category[]>([]);

  private previewTimer: ReturnType<typeof setTimeout> | undefined;
  private previewGeneration = 0;

  /** Подписи единиц согласованы с числом: «раз в 2 недели», а не «2 неделя». */
  protected readonly unitOptions = computed(() => {
    const value = Number(this.intervalValueText());
    const count = Number.isInteger(value) && value > 0 ? value : 1;

    return INTERVAL_UNITS.map((unit) => ({ unit, label: intervalUnitLabel(unit, count) }));
  });

  protected readonly amount = computed(() => parseAmount(this.amountText()));

  protected readonly currencyCode = computed(
    () => this.currencies.find(this.currencyId())?.code ?? 'Выбрать',
  );

  protected readonly categoryLabel = computed(() => {
    const category = this.category();

    return category ? categoryPath(category, this.allCategories()) : 'Без категории';
  });

  protected readonly descriptionError = computed(() =>
    this.description().trim() === '' ? 'Укажите описание' : null,
  );

  protected readonly currencyError = computed(() =>
    this.currencyId() === '' ? 'Выберите валюту' : null,
  );

  protected readonly amountError = computed(() => {
    const value = this.amount();
    if (value === null) {
      return 'Введите сумму числом';
    }

    return value > 0 ? null : 'Сумма должна быть больше нуля';
  });

  protected readonly intervalError = computed(() => {
    if (this.recurrenceKind() !== 'Interval') {
      return null;
    }

    const value = Number(this.intervalValueText());

    return Number.isInteger(value) && value >= 1 && value <= MAX_INTERVAL_VALUE
      ? null
      : `Шаг - целое число от 1 до ${MAX_INTERVAL_VALUE}`;
  });

  protected readonly startDateError = computed(() =>
    dateFieldError(this.startDateText(), 'Укажите дату начала'),
  );

  protected readonly startTimeError = computed(() => timeFieldError(this.startTimeText()));

  protected readonly startError = computed(
    () => this.startDateError() ?? this.startTimeError(),
  );

  /**
   * Дату окончания раньше начала сервер отвергает.
   *
   * Проверяется на клиенте, потому что предпросмотр уходит по мере ввода, и
   * без этой проверки каждое промежуточное правило било бы в отказ.
   */
  protected readonly endError = computed(() => {
    // У однократного правила поля окончания на экране нет, и его ошибка
    // блокировала бы сохранение без единого сообщения перед глазами.
    if (this.recurrenceKind() !== 'Interval') {
      return null;
    }

    const text = this.endDateText();
    if (!text) {
      return null;
    }

    const end = parseApiDate(text);
    if (!end) {
      return 'Укажите дату окончания или очистите поле';
    }

    const start = parseApiDate(this.startDateText());

    return start && end < start ? 'Окончание раньше начала' : null;
  });

  /** Правило целиком или null, если поля ещё не сложились в допустимое. */
  protected readonly rule = computed<RecurrenceInput | null>(() => {
    if (this.startError() || this.endError() || this.intervalError()) {
      return null;
    }

    const start = parseApiDate(this.startDateText());
    if (!start) {
      return null;
    }

    // Дата окончания относится только к повторяющемуся правилу: у однократного
    // она может лишь отменить единственное срабатывание.
    const isInterval = this.recurrenceKind() === 'Interval';
    const end = isInterval ? parseApiDate(this.endDateText()) : null;

    return {
      recurrenceKind: this.recurrenceKind(),
      intervalUnit: isInterval ? this.intervalUnit() : null,
      intervalValue: isInterval ? Number(this.intervalValueText()) : 0,
      startDate: formatApiDate(start),
      startTime: this.startTimeText(),
      endDate: end ? formatApiDate(end) : null,
    };
  });

  protected readonly canSave = computed(
    () =>
      !this.isSaving() &&
      this.descriptionError() === null &&
      this.amountError() === null &&
      this.currencyError() === null &&
      this.rule() !== null,
  );

  constructor() {
    // Клик мимо, Escape и системная кнопка «Назад» закрывают лист напрямую,
    // мимо close(), а значит и мимо защиты от закрытия во время сохранения.
    closeOnDismiss(this.dialogRef, () => this.close());

    this.spendingApi.getCategories().subscribe({
      next: (categories) => this.allCategories.set(categories),
    });

    // Предпросмотр пересчитывается на любое изменение правила, а не только
    // полей даты: единица интервала так же двигает весь ряд.
    effect(() => this.schedulePreview(this.rule()));
  }

  ngOnDestroy(): void {
    clearTimeout(this.previewTimer);
  }

  // ------------------------------------------------------------ поля

  protected onDescription(event: Event): void {
    this.touchedDescription.set(true);
    this.description.set((event.target as HTMLInputElement).value);
  }

  protected onAmount(event: Event): void {
    this.touchedAmount.set(true);
    this.amountText.set((event.target as HTMLInputElement).value);
  }

  protected onIntervalValue(event: Event): void {
    this.intervalValueText.set((event.target as HTMLInputElement).value);
  }

  protected onIntervalUnit(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const unit = INTERVAL_UNITS.find((item) => item === value);

    if (unit) {
      this.intervalUnit.set(unit);
    }
  }

  protected onStartDate(value: string): void {
    this.touchedStart.set(true);
    this.startDateText.set(value);
  }

  protected onStartTime(value: string): void {
    this.touchedStart.set(true);
    this.startTimeText.set(value);
  }

  protected onEndDate(value: string): void {
    this.endDateText.set(value);
  }

  protected setKind(kind: RecurrenceKind): void {
    this.recurrenceKind.set(kind);
  }

  protected pickCurrency(): void {
    this.sheets
      .openSheet<Currency, CurrencyPickerData>(
        CurrencyPickerSheet,
        { selectedId: this.currencyId() },
        { ariaLabel: 'Выбор валюты' },
      )
      .closed.subscribe((currency) => {
        this.touchedCurrency.set(true);

        if (currency) {
          this.currencyId.set(currency.id);
        }
      });
  }

  // ------------------------------------------------------------ разметка

  protected pickCategory(): void {
    this.sheets
      .openSheet<CategoryPickerResult, CategoryPickerData>(
        CategoryPickerSheet,
        {
          // Заводить категорию отсюда пока не умеем: кнопка «Создать» без
          // обработчика выглядела бы как сломанная.
          allowCreate: false,
          rootOptionLabel: this.category() ? 'Убрать категорию' : undefined,
        },
        { ariaLabel: 'Выбор категории' },
      )
      .closed.subscribe((result) => {
        if (!result) {
          return;
        }

        this.category.set(result.kind === 'existing' ? result.category : null);
      });
  }

  protected addTag(): void {
    this.sheets
      .openSheet<TagPickerResult, TagPickerData>(
        TagPickerSheet,
        { excludedIds: this.tags.selectedIds() },
        { ariaLabel: 'Выбор тега' },
      )
      .closed.subscribe((result) => {
        if (!result) {
          return;
        }

        if (result.kind === 'existing') {
          this.tags.addExisting(result.tag);
        } else {
          this.tags.addNew(result.title);
        }

        this.telegram.impact('light');
      });
  }

  protected removeTag(tag: DraftTag): void {
    this.tags.remove(tag);
    this.telegram.impact('light');
  }

  // ------------------------------------------------------------ предпросмотр

  private schedulePreview(rule: RecurrenceInput | null): void {
    clearTimeout(this.previewTimer);

    // Поколение поднимается на смене правила, а не на старте запроса: иначе
    // ответ на прежнее правило успевал бы лечь на экран как актуальный.
    const generation = ++this.previewGeneration;

    this.previewFailed.set(false);

    if (!rule) {
      this.preview.set([]);
      this.isPreviewLoading.set(false);

      return;
    }

    this.isPreviewLoading.set(true);
    this.previewTimer = setTimeout(
      () => this.requestPreview(rule, generation),
      PREVIEW_DEBOUNCE_MS,
    );
  }

  private requestPreview(rule: RecurrenceInput, generation: number): void {
    this.api.previewOccurrences(rule).subscribe({
      next: (occurrences) => {
        if (generation !== this.previewGeneration) {
          return;
        }

        this.preview.set(occurrences);
        this.isPreviewLoading.set(false);
      },
      // Плашку по этому запросу перехватчик не рисует: промежуточное правило
      // сервер законно отвергает. Но отказ нельзя выдавать за «дат не будет» -
      // сеть могла просто не дойти.
      error: () => {
        if (generation !== this.previewGeneration) {
          return;
        }

        this.preview.set([]);
        this.previewFailed.set(true);
        this.isPreviewLoading.set(false);
      },
    });
  }

  // ------------------------------------------------------------ сохранение

  protected save(): void {
    const rule = this.rule();
    const amount = this.amount();
    if (!this.canSave() || !rule || amount === null) {
      return;
    }

    this.isSaving.set(true);

    const original = this.original;

    // Заведённые в листе теги идут первыми: расписание хранит их списком
    // идентификаторов, а идентификатор нового тега знает только сервер.
    this.tags
      .resolveIds(this.spendingApi)
      .pipe(
        switchMap((tagIds) => {
          const input: SpendingScheduleInput = {
            ...rule,
            description: this.description().trim(),
            amount,
            currencyId: this.currencyId(),
            categoryId: this.category()?.id ?? null,
            tagIds,
          };

          return original
            ? this.api.updateSchedule(original.id, input).pipe(map(() => original.id))
            : this.api.createSchedule(input);
        }),
      )
      .subscribe({
        next: (id) =>
          this.finish(id, original ? 'Расписание сохранено' : 'Расписание создано'),
        error: (error: unknown) => this.failSave(error),
      });
  }

  /**
   * Оставляет лист открытым после сбоя.
   *
   * Состояние не теряется: заведённые теги уже получили идентификаторы, и
   * повторное сохранение не заведёт их второй раз. Об отказе сервера сообщает
   * перехватчик, плашка нужна только собственным ошибкам сохранения.
   */
  private failSave(error: unknown): void {
    this.isSaving.set(false);

    if (!(error instanceof HttpErrorResponse)) {
      this.toast.error('Не удалось сохранить изменения');
    }
  }

  protected close(): void {
    // Закрытие поверх незавершённого сохранения оставило бы расписание
    // созданным, а список - без него: ответ придёт в уничтоженный лист.
    if (this.isSaving()) {
      return;
    }

    this.dialogRef.close();
  }

  private finish(id: string, message: string): void {
    this.telegram.notify('success');
    this.toast.success(message);
    this.dialogRef.close({ kind: 'saved', id });
  }
}

/** Значение поля даты: тот же вид dd.MM.yyyy, в котором дату шлёт сервер. */
function toFieldValue(value: string | null | undefined): string {
  const date = parseCalendarDate(value);

  return date ? formatApiDate(date) : '';
}
