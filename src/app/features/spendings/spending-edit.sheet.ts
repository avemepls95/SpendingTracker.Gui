import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Observable, concat, tap } from 'rxjs';

import { SheetService } from '../../core/ui/sheet.service';
import { TelegramService } from '../../core/telegram/telegram.service';
import { ToastService } from '../../core/ui/toast.service';
import { SpendingApiService } from '../../domain/api/spending-api.service';
import {
  Category,
  Currency,
  Spending,
  SpendingCategorySource,
  Tag,
} from '../../domain/models/models';
import { CurrenciesStore } from '../../domain/stores/currencies.store';
import { confirmAction } from '../../shared/ui/confirm.dialog';
import { MarkupSourceMarkComponent } from '../../shared/ui/markup-source-mark.component';
import { spendingsCount } from '../../shared/util/plural.util';
import {
  CurrencyPickerData,
  CurrencyPickerSheet,
} from '../../shared/ui/currency-picker.sheet';
import { IconComponent } from '../../shared/ui/icon.component';
import { SwipeToCloseDirective } from '../../shared/util/swipe-to-close.directive';
import {
  formatApiDate,
  formatInputDate,
  parseCalendarDate,
} from '../../shared/util/date.util';
import { parseAmount } from '../../shared/util/money.util';
import { closeOnDismiss } from '../../shared/util/dismiss.util';
import { categoryPath } from '../../shared/util/category-tree.util';
import { DraftTag, DraftTags, draftTagKey } from '../../shared/util/tag-draft.util';
import {
  CategoryPickerData,
  CategoryPickerResult,
  CategoryPickerSheet,
} from '../../shared/ui/category-picker.sheet';
import {
  TagPickerData,
  TagPickerResult,
  TagPickerSheet,
} from '../../shared/ui/tag-picker.sheet';
import {
  MarkupGuideData,
  MarkupGuideSection,
  MarkupGuideSheet,
} from '../help/markup-guide.sheet';

export type SpendingEditResult =
  | {
      readonly kind: 'updated';
      readonly spending: Spending;
      /**
       * Разметка менялась не только у этой траты: каскад установки категории и
       * отказ работают по всему описанию сразу. Список в этом случае устарел
       * целиком, и заменой одной строки его не починить.
       */
      readonly affectedOthers: boolean;
    }
  | { readonly kind: 'deleted'; readonly id: string };

/**
 * Выбор категории в листе.
 *
 * Категории, заведённой прямо из выбора, на сервере ещё нет: её создаст
 * сохранение, а до него о ней известно только название.
 */
type CategoryChoice =
  | { readonly kind: 'none' }
  | { readonly kind: 'existing'; readonly category: Category }
  | { readonly kind: 'new'; readonly title: string };

/**
 * Правка траты: поля и разметка.
 *
 * Всё, что человек меняет в листе, копится в его состоянии и уходит на сервер
 * пачкой запросов по кнопке «Сохранить». Закрытие листа не применяет ничего,
 * кроме уже подтверждённого отдельно отказа от разметки.
 */
@Component({
  selector: 'app-spending-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, MarkupSourceMarkComponent, SwipeToCloseDirective],
  templateUrl: './spending-edit.sheet.html',
  styleUrl: './spending-edit.sheet.scss',
})
export class SpendingEditSheet {
  private readonly original = inject<Spending>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<SpendingEditResult>>(DialogRef);
  private readonly api = inject(SpendingApiService);
  private readonly sheets = inject(SheetService);
  private readonly telegram = inject(TelegramService);
  private readonly toast = inject(ToastService);
  private readonly currencies = inject(CurrenciesStore);

  protected readonly description = signal(this.original.description);
  protected readonly amountText = signal(formatAmountForInput(this.original.amount));
  protected readonly currencyId = signal(this.original.currencyId);
  protected readonly dateText = signal(toInputValue(this.original.date));

  protected readonly choice = signal<CategoryChoice>(toChoice(this.original.category));
  protected readonly tags = new DraftTags(this.original.tags);

  /**
   * Разметка, известная серверу.
   *
   * С ней сравнивается выбор в листе: на сервер уходит только разница. Меняется
   * от отказа и от сохранения - в том числе от пачки, оборвавшейся посередине.
   */
  private readonly savedChoice = signal<CategoryChoice>(toChoice(this.original.category));
  private readonly savedTags = signal<readonly Tag[]>(this.original.tags);
  private readonly savedSource = signal<SpendingCategorySource | null>(
    this.original.categorySource,
  );

  protected readonly isSaving = signal(false);
  protected readonly isMarkupBusy = signal(false);

  /** Хотя бы один запрос листа уже применился на сервере. */
  private hasAppliedChanges = false;

  /** Хотя бы одна операция за сеанс правки задела другие траты описания. */
  private readonly affectedOthers = signal(false);

  /** Все категории владельца: нужны, чтобы показать путь до выбранной. */
  private readonly allCategories = signal<readonly Category[]>([]);

  protected readonly tagKey = draftTagKey;

  protected readonly amount = computed(() => parseAmount(this.amountText()));

  protected readonly isBusy = computed(() => this.isSaving() || this.isMarkupBusy());

  protected readonly currencyCode = computed(
    () => this.currencies.find(this.currencyId())?.code ?? 'Выбрать',
  );

  protected readonly hasCategory = computed(() => this.choice().kind !== 'none');

  protected readonly categoryLabel = computed(() => {
    const choice = this.choice();

    switch (choice.kind) {
      case 'existing':
        return categoryPath(choice.category, this.allCategories());
      case 'new':
        return choice.title;
      default:
        return 'Без категории';
    }
  });

  private readonly isCategoryChanged = computed(
    () => !isSameChoice(this.choice(), this.savedChoice()),
  );

  /**
   * Источник категории, показанный в карточке.
   *
   * Он относится к разметке на сервере, поэтому у выбранной, но ещё не
   * сохранённой категории источника нет.
   */
  protected readonly categorySource = computed(() =>
    this.isCategoryChanged() ? null : this.savedSource(),
  );

  protected readonly descriptionError = computed(() =>
    this.description().trim() === '' ? 'Укажите описание' : null,
  );

  protected readonly amountError = computed(() => {
    const value = this.amount();
    if (value === null) {
      return 'Введите сумму числом';
    }

    return value === 0 ? 'Сумма не может быть нулевой' : null;
  });

  protected readonly dateError = computed(() =>
    parseCalendarDate(this.dateText()) ? null : 'Укажите дату',
  );

  /**
   * Отказ предлагается, только когда категорию поставил словарь.
   *
   * При источнике Manual действие было бы обманом: отказ снимает категорию со
   * всех трат описания, кроме размеченных вручную, то есть именно на этой
   * трате ничего бы не изменилось. Пустой источник - трата из очереди, ей
   * отказывать не от чего.
   */
  protected readonly canReject = computed(() => {
    const source = this.categorySource();

    return source === 'Model' || source === 'History';
  });

  /** Пояснение к отказу в диалоге подтверждения: чьё решение отвергают. */
  private readonly rejectHint = computed(() =>
    this.savedSource() === 'Model'
      ? 'Модель об этом описании больше не спросят, пока вы не назначите категорию сами.'
      : 'Прошлое решение по этому описанию перестанет применяться к новым тратам.',
  );

  protected readonly canSave = computed(
    () =>
      !this.isBusy() &&
      this.descriptionError() === null &&
      this.amountError() === null &&
      this.dateError() === null &&
      this.currencyId() !== '',
  );

  constructor() {
    // Отказ от разметки применяется сразу, и его результат надо донести до
    // страницы при любом способе закрытия, включая Escape и клик мимо.
    closeOnDismiss(this.dialogRef, () => this.close());

    this.api.getCategories().subscribe({
      next: (categories) => this.allCategories.set(categories),
    });
  }

  // ------------------------------------------------------------ поля

  protected onDescription(event: Event): void {
    this.description.set((event.target as HTMLInputElement).value);
  }

  protected onAmount(event: Event): void {
    this.amountText.set((event.target as HTMLInputElement).value);
  }

  protected onDate(event: Event): void {
    this.dateText.set((event.target as HTMLInputElement).value);
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

  /**
   * Открывает справку поверх карточки.
   *
   * Именно листом: карточка держит несохранённые поля, и уход по адресу их
   * потерял бы.
   */
  protected openGuide(section: MarkupGuideSection): void {
    this.sheets.openSheet<void, MarkupGuideData>(
      MarkupGuideSheet,
      { section },
      { ariaLabel: 'Как размечать траты' },
    );
  }

  // ------------------------------------------------------------ категория

  protected pickCategory(): void {
    const choice = this.choice();

    this.sheets
      .openSheet<CategoryPickerResult, CategoryPickerData>(
        CategoryPickerSheet,
        {
          excludedIds: choice.kind === 'existing' ? [choice.category.id] : [],
          rootOptionLabel: choice.kind === 'none' ? undefined : 'Убрать категорию',
        },
        { ariaLabel: 'Выбор категории' },
      )
      .closed.subscribe((result) => {
        if (!result) {
          return;
        }

        this.choice.set(toChoiceFromPicker(result));
        this.telegram.impact('light');
      });
  }

  /**
   * Отказ от разметки описания.
   *
   * Массовая операция, поэтому с подтверждением - и единственное действие
   * листа, которое применяется сразу: откладывать до «Сохранить» подтверждённую
   * правку чужих трат значило бы обманывать текст подтверждения. Отправляется
   * по трате, а не по записи словаря: карточка знает трату, а записи по её
   * описанию может уже не быть - тогда отказ её создаст.
   */
  protected async reject(): Promise<void> {
    const confirmed = await confirmAction(this.sheets, this.telegram, {
      title: 'Отвергнуть разметку?',
      message:
        `Категория снимется со всех трат с описанием «${this.original.description}», ` +
        `кроме размеченных вручную. ${this.rejectHint()}`,
      confirmLabel: 'Отвергнуть',
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    this.isMarkupBusy.set(true);

    this.api.rejectMarkup({ spendingId: this.original.id }).subscribe({
      next: (result) => {
        // wasApplied: false - «уже обработано», а не сбой: описание успели
        // отвергнуть из другой вкладки или кнопкой в телеграме.
        if (!result.wasApplied) {
          this.toast.info('Уже обработано');
        } else {
          this.hasAppliedChanges = true;

          // Отказ считает и саму эту трату - её источник не Manual, иначе
          // действие бы не показывалось. Значит другие траты задеты только
          // начиная со второй.
          if (result.affectedSpendings > 1) {
            this.affectedOthers.set(true);
          }

          this.toast.success(
            result.affectedSpendings > 0
              ? `Разметка снята с ${spendingsCount(result.affectedSpendings)}`
              : 'Разметка отвергнута',
          );
        }

        this.refreshMarkup();
      },
      error: () => this.isMarkupBusy.set(false),
    });
  }

  // ------------------------------------------------------------ теги

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

  /**
   * Перечитывает разметку траты после отказа.
   *
   * Теги отказ не трогает, поэтому выбор в листе остаётся как был: сравнивать
   * его по-прежнему не с чем, кроме серверных тегов.
   */
  private refreshMarkup(): void {
    this.api.getSpendingById(this.original.id).subscribe({
      next: (spending) => {
        this.savedChoice.set(toChoice(spending.category));
        this.savedTags.set(spending.tags);
        this.savedSource.set(spending.categorySource);
        this.choice.set(toChoice(spending.category));
        this.isMarkupBusy.set(false);
        this.telegram.impact('light');
      },
      error: () => this.isMarkupBusy.set(false),
    });
  }

  // ------------------------------------------------------------ сохранение

  protected save(): void {
    const amount = this.amount();
    const date = parseCalendarDate(this.dateText());
    if (!this.canSave() || amount === null || !date) {
      return;
    }

    this.isSaving.set(true);

    const updated: Spending = {
      ...this.original,
      description: this.description().trim(),
      amount,
      currencyId: this.currencyId(),
      // Формат сервера, а не поля ввода: этот объект уходит в список вместо
      // прежней траты, и yyyy-MM-dd разъехался бы с датами соседних строк.
      date: formatApiDate(date),
      category: savedCategory(this.savedChoice()),
      tags: this.savedTags(),
      categorySource: this.savedSource(),
    };

    const requests: Observable<unknown>[] = [];

    // Поля идут первыми: смена описания меняет ключ словаря, а с ним и разметку
    // самой траты, поэтому выбранная категория должна применяться после неё.
    if (isFieldsChanged(updated, this.original)) {
      requests.push(
        this.api.updateSpending({
          id: updated.id,
          amount: updated.amount,
          currencyId: updated.currencyId,
          date,
          description: updated.description,
        }),
      );
    }

    const categoryRequest = this.categoryRequest();
    if (categoryRequest) {
      requests.push(categoryRequest);
    }

    const tagRequests = this.tags.requests(this.api, (tagId, isSet) =>
      this.api.setSpendingTag(this.original.id, tagId, isSet),
    );
    requests.push(...tagRequests);

    const markupChanged = categoryRequest !== null || tagRequests.length > 0;

    if (requests.length === 0) {
      // Менять нечего: сообщать о сохранении, которого не было, незачем.
      this.closeWithResult();
      return;
    }

    concat(...requests).subscribe({
      next: () => (this.hasAppliedChanges = true),
      complete: () => this.finishSave(updated, markupChanged),
      error: (error: unknown) => this.failSave(error),
    });
  }

  protected async remove(): Promise<void> {
    const confirmed = await confirmAction(this.sheets, this.telegram, {
      title: 'Удалить трату?',
      message: `«${this.original.description}» исчезнет из списка и аналитики. Отменить это нельзя.`,
      confirmLabel: 'Удалить',
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    this.isSaving.set(true);
    this.api.deleteSpending(this.original.id).subscribe({
      next: () => {
        this.telegram.notify('success');
        this.dialogRef.close({ kind: 'deleted', id: this.original.id });
      },
      error: () => this.isSaving.set(false),
    });
  }

  /** Запрос, приводящий категорию траты к выбору в листе. */
  private categoryRequest(): Observable<unknown> | null {
    const choice = this.choice();
    if (!this.isCategoryChanged()) {
      return null;
    }

    const request =
      choice.kind === 'new'
        ? this.api.linkSpendingToNewCategory(this.original.id, choice.title)
        : this.api.setSpendingCategory(
            this.original.id,
            choice.kind === 'existing' ? choice.category.id : null,
          );

    return request.pipe(
      tap((affected) => {
        // Каскад назначает категорию и тем тратам, у которых её не было,
        // поэтому число сообщается всегда, когда оно ненулевое. Саму
        // правленую трату сервер в него не включает. При снятии категории
        // каскада нет и приходит ноль - молчать тут правильно.
        if (affected > 0) {
          this.affectedOthers.set(true);
          this.toast.info(`Поправлено ещё ${spendingsCount(affected)}`);
        }

        // Выбор ушёл на сервер: повтор после сбоя посреди пачки не заведёт
        // вторую категорию с тем же названием. Источник теперь известен
        // только серверу - его принесёт перечитывание.
        this.savedChoice.set(choice);
        this.savedSource.set(null);
      }),
    );
  }

  /**
   * Закрывает лист после сохранения.
   *
   * Разметку приходится перечитывать: идентификаторы созданных категории и
   * тегов знает только сервер, а смена описания меняет ключ словаря и вместе с
   * ним разметку самой траты.
   */
  private finishSave(updated: Spending, markupChanged: boolean): void {
    this.telegram.notify('success');
    this.toast.success('Трата сохранена');

    if (!markupChanged && updated.description === this.original.description) {
      this.dialogRef.close({
        kind: 'updated',
        spending: updated,
        affectedOthers: this.affectedOthers(),
      });

      return;
    }

    this.api.getSpendingById(updated.id).subscribe({
      next: (fresh) => {
        // Берётся только разметка: scheduleId этот ответ не несёт, и пометка
        // «по расписанию» из списка пропала бы.
        this.dialogRef.close({
          kind: 'updated',
          affectedOthers: this.affectedOthers(),
          spending: {
            ...updated,
            category: fresh.category,
            tags: fresh.tags,
            categorySource: fresh.categorySource,
          },
        });
      },
      // Трата уже сохранена, отменять нечего: закрываем с тем, что знаем.
      // Про сбой сообщил перехватчик.
      error: () =>
        this.dialogRef.close({
          kind: 'updated',
          spending: updated,
          affectedOthers: this.affectedOthers(),
        }),
    });
  }

  /**
   * Оставляет лист открытым после сбоя.
   *
   * Состояние не теряется, повторное сохранение доотправит только то, что не
   * успело примениться. Об отказе сервера сообщает перехватчик, плашка нужна
   * только собственным ошибкам сохранения.
   */
  private failSave(error: unknown): void {
    this.isSaving.set(false);

    if (!(error instanceof HttpErrorResponse)) {
      this.toast.error('Не удалось сохранить изменения');
    }

    // Пачка оборвалась посередине: что именно осталось в базе, лист уже не
    // знает, и страница должна перечитать список целиком.
    if (this.hasAppliedChanges) {
      this.affectedOthers.set(true);
    }
  }

  protected close(): void {
    // Закрытие поверх незавершённого запроса отдало бы результат до первого
    // успешного ответа: страница не узнала бы про изменения, а запросы всё
    // равно дошли бы до сервера.
    if (this.isBusy()) {
      return;
    }

    this.closeWithResult();
  }

  private closeWithResult(): void {
    if (!this.hasAppliedChanges) {
      this.dialogRef.close();
      return;
    }

    this.dialogRef.close({
      kind: 'updated',
      affectedOthers: this.affectedOthers(),
      spending: {
        ...this.original,
        category: savedCategory(this.savedChoice()),
        tags: this.savedTags(),
        categorySource: this.savedSource(),
      },
    });
  }
}

function toChoice(category: Category | null): CategoryChoice {
  return category ? { kind: 'existing', category } : { kind: 'none' };
}

function toChoiceFromPicker(result: CategoryPickerResult): CategoryChoice {
  switch (result.kind) {
    case 'existing':
      return { kind: 'existing', category: result.category };
    case 'new':
      return { kind: 'new', title: result.title };
    default:
      return { kind: 'none' };
  }
}

/** Категория выбора, известная как сущность: у новой её ещё нет. */
function savedCategory(choice: CategoryChoice): Category | null {
  return choice.kind === 'existing' ? choice.category : null;
}

function isSameChoice(left: CategoryChoice, right: CategoryChoice): boolean {
  if (left.kind !== right.kind) {
    return false;
  }

  if (left.kind === 'existing' && right.kind === 'existing') {
    return left.category.id === right.category.id;
  }

  if (left.kind === 'new' && right.kind === 'new') {
    return left.title === right.title;
  }

  return true;
}

function isFieldsChanged(updated: Spending, original: Spending): boolean {
  return (
    updated.description !== original.description ||
    updated.amount !== original.amount ||
    updated.currencyId !== original.currencyId ||
    // Обе даты приводятся к одному виду: в списке трата может лежать как в
    // формате сервера, так и в формате прошлого оптимистичного обновления.
    toInputValue(updated.date) !== toInputValue(original.date)
  );
}

function toInputValue(value: string): string {
  const date = parseCalendarDate(value);
  return date ? formatInputDate(date) : '';
}

/** В поле ввода дробная часть отделяется точкой, без разделителей разрядов. */
function formatAmountForInput(amount: number): string {
  return String(amount);
}
