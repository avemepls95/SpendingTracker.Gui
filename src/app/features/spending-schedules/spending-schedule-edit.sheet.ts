import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

import { SheetService } from '../../core/ui/sheet.service';
import { TelegramService } from '../../core/telegram/telegram.service';
import { ToastService } from '../../core/ui/toast.service';
import { SpendingApiService } from '../../domain/api/spending-api.service';
import { SpendingScheduleApiService } from '../../domain/api/spending-schedule-api.service';
import {
  Category,
  Currency,
  INTERVAL_UNITS,
  INTERVAL_UNIT_LABELS,
  IntervalUnit,
  RecurrenceInput,
  RecurrenceKind,
  SpendingScheduleDetails,
  SpendingScheduleInput,
  Tag,
} from '../../domain/models/models';
import { CurrenciesStore } from '../../domain/stores/currencies.store';
import {
  CategoryPickerData,
  CategoryPickerResult,
  CategoryPickerSheet,
} from '../../shared/ui/category-picker.sheet';
import {
  CurrencyPickerData,
  CurrencyPickerSheet,
} from '../../shared/ui/currency-picker.sheet';
import { IconComponent } from '../../shared/ui/icon.component';
import {
  TagPickerData,
  TagPickerResult,
  TagPickerSheet,
} from '../../shared/ui/tag-picker.sheet';
import { categoryPath } from '../../shared/util/category-tree.util';
import {
  formatApiDate,
  formatInputDate,
  parseCalendarDate,
} from '../../shared/util/date.util';
import { parseAmount } from '../../shared/util/money.util';
import { SwipeToCloseDirective } from '../../shared/util/swipe-to-close.directive';

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
const TIME_PATTERN = /^\d{2}:\d{2}$/;

@Component({
  selector: 'app-spending-schedule-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SwipeToCloseDirective],
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

  private readonly original = this.data.schedule;

  protected readonly isNew = this.original === null;

  protected readonly unitOptions = INTERVAL_UNITS.map((unit) => ({
    unit,
    label: INTERVAL_UNIT_LABELS[unit],
  }));

  protected readonly description = signal(this.original?.description ?? '');
  protected readonly amountText = signal(this.original ? String(this.original.amount) : '');
  protected readonly currencyId = signal(this.original?.currencyId ?? '');
  protected readonly category = signal<Category | null>(this.original?.category ?? null);
  protected readonly tags = signal<readonly Tag[]>(this.original?.tags ?? []);

  protected readonly recurrenceKind = signal<RecurrenceKind>(
    this.original?.recurrenceKind ?? 'Interval',
  );
  protected readonly intervalValueText = signal(String(this.original?.intervalValue || 1));
  protected readonly intervalUnit = signal<IntervalUnit>(
    this.original?.intervalUnit ?? 'Month',
  );

  protected readonly startDateText = signal(toInputDate(this.original?.startDate));
  protected readonly startTimeText = signal(this.original?.startTime ?? '10:00');
  protected readonly endDateText = signal(toInputDate(this.original?.endDate));

  /**
   * Поля, которых пользователь уже касался.
   *
   * У нового расписания пустая форма невалидна вся сразу, и без этого экран
   * встречал бы тремя красными строками до первого нажатия.
   */
  protected readonly touchedDescription = signal(false);
  protected readonly touchedAmount = signal(false);
  protected readonly touchedStart = signal(false);

  protected readonly isSaving = signal(false);
  protected readonly isMarkupBusy = signal(false);
  protected readonly preview = signal<readonly string[]>([]);
  protected readonly isPreviewLoading = signal(false);

  /** Все категории владельца: нужны, чтобы показать путь до выбранной. */
  private readonly allCategories = signal<readonly Category[]>([]);

  private previewTimer: ReturnType<typeof setTimeout> | undefined;
  private previewGeneration = 0;

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

  protected readonly startError = computed(() => {
    if (!parseCalendarDate(this.startDateText())) {
      return 'Укажите дату начала';
    }

    return TIME_PATTERN.test(this.startTimeText()) ? null : 'Укажите время';
  });

  /**
   * Дату окончания раньше начала сервер отвергает.
   *
   * Проверяется на клиенте, потому что предпросмотр уходит по мере ввода, и
   * без этой проверки каждое промежуточное правило било бы в отказ.
   */
  protected readonly endError = computed(() => {
    const text = this.endDateText();
    if (!text) {
      return null;
    }

    const end = parseCalendarDate(text);
    if (!end) {
      return 'Укажите дату окончания или очистите поле';
    }

    const start = parseCalendarDate(this.startDateText());

    return start && end < start ? 'Окончание раньше начала' : null;
  });

  /** Правило целиком или null, если поля ещё не сложились в допустимое. */
  protected readonly rule = computed<RecurrenceInput | null>(() => {
    if (this.startError() || this.endError() || this.intervalError()) {
      return null;
    }

    const start = parseCalendarDate(this.startDateText());
    if (!start) {
      return null;
    }

    // Дата окончания относится только к повторяющемуся правилу: у однократного
    // она может лишь отменить единственное срабатывание.
    const isInterval = this.recurrenceKind() === 'Interval';
    const end = isInterval ? parseCalendarDate(this.endDateText()) : null;

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
      this.currencyId() !== '' &&
      this.rule() !== null,
  );

  constructor() {
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

  protected onStartDate(event: Event): void {
    this.touchedStart.set(true);
    this.startDateText.set((event.target as HTMLInputElement).value);
  }

  protected onStartTime(event: Event): void {
    this.touchedStart.set(true);
    this.startTimeText.set((event.target as HTMLInputElement).value);
  }

  protected onEndDate(event: Event): void {
    this.endDateText.set((event.target as HTMLInputElement).value);
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
          // Завести категорию отсюда нельзя: расписание уходит одним запросом,
          // а идентификатор новой категории знает только сервер.
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
        { excludedIds: this.tags().map((tag) => tag.id) },
        { ariaLabel: 'Выбор тега' },
      )
      .closed.subscribe((result) => {
        if (!result) {
          return;
        }

        if (result.kind === 'existing') {
          this.tags.update((current) => [...current, result.tag]);
          return;
        }

        // Идентификатор нового тега знает только сервер, а createTag его не
        // возвращает, поэтому список перечитывается и тег ищется по названию.
        this.isMarkupBusy.set(true);
        this.spendingApi.createTag(result.title).subscribe({
          next: () => this.attachCreatedTag(result.title),
          error: () => this.isMarkupBusy.set(false),
        });
      });
  }

  protected removeTag(tag: Tag): void {
    this.tags.update((current) => current.filter((item) => item.id !== tag.id));
  }

  private attachCreatedTag(title: string): void {
    this.spendingApi.getTags().subscribe({
      next: (tags) => {
        const created = tags.find(
          (tag) => tag.title.toLowerCase() === title.toLowerCase(),
        );

        if (created) {
          this.tags.update((current) => [...current, created]);
        }

        this.isMarkupBusy.set(false);
      },
      error: () => this.isMarkupBusy.set(false),
    });
  }

  // ------------------------------------------------------------ предпросмотр

  private schedulePreview(rule: RecurrenceInput | null): void {
    clearTimeout(this.previewTimer);

    if (!rule) {
      // Ответ на прежнее правило уже не нужен: поля успели уйти в недопустимое.
      this.previewGeneration += 1;
      this.preview.set([]);
      this.isPreviewLoading.set(false);

      return;
    }

    this.isPreviewLoading.set(true);
    this.previewTimer = setTimeout(() => this.requestPreview(rule), PREVIEW_DEBOUNCE_MS);
  }

  private requestPreview(rule: RecurrenceInput): void {
    const generation = ++this.previewGeneration;

    this.api.previewOccurrences(rule).subscribe({
      next: (occurrences) => {
        if (generation !== this.previewGeneration) {
          return;
        }

        this.preview.set(occurrences);
        this.isPreviewLoading.set(false);
      },
      // Правило без будущих срабатываний сервер отвергает - показываем пусто.
      // Плашку по этому запросу перехватчик не рисует, текст ошибки
      // пользователь увидит при попытке сохранить.
      error: () => {
        if (generation !== this.previewGeneration) {
          return;
        }

        this.preview.set([]);
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

    const input: SpendingScheduleInput = {
      ...rule,
      description: this.description().trim(),
      amount,
      currencyId: this.currencyId(),
      categoryId: this.category()?.id ?? null,
      tagIds: this.tags().map((tag) => tag.id),
    };

    const original = this.original;

    if (original) {
      this.api.updateSchedule(original.id, input).subscribe({
        next: () => this.finish(original.id, 'Расписание сохранено'),
        error: () => this.isSaving.set(false),
      });

      return;
    }

    this.api.createSchedule(input).subscribe({
      next: (id) => this.finish(id, 'Расписание создано'),
      error: () => this.isSaving.set(false),
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }

  private finish(id: string, message: string): void {
    this.telegram.notify('success');
    this.toast.success(message);
    this.dialogRef.close({ kind: 'saved', id });
  }
}

/** Значение <input type="date">: сервер шлёт dd.MM.yyyy, поле ждёт yyyy-MM-dd. */
function toInputDate(value: string | null | undefined): string {
  const date = parseCalendarDate(value);

  return date ? formatInputDate(date) : '';
}
