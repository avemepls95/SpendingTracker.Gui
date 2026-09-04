import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

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
  formatInputDate,
  parseCalendarDate,
} from '../../shared/util/date.util';
import { parseAmount } from '../../shared/util/money.util';
import { closeOnDismiss } from '../../shared/util/dismiss.util';
import { categoryPath } from '../../shared/util/category-tree.util';
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

export type SpendingEditResult =
  | { readonly kind: 'updated'; readonly spending: Spending }
  | { readonly kind: 'deleted'; readonly id: string };

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

  /** Разметка меняется отдельными запросами и применяется сразу. */
  protected readonly category = signal<Category | null>(this.original.category);
  protected readonly tags = signal<readonly Tag[]>(this.original.tags);
  protected readonly categorySource = signal<SpendingCategorySource | null>(
    this.original.categorySource,
  );

  protected readonly isSaving = signal(false);
  protected readonly isMarkupBusy = signal(false);

  /** Все категории владельца: нужны, чтобы показать путь до выбранной. */
  private readonly allCategories = signal<readonly Category[]>([]);

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

  /** Пояснение к отказу зависит от того, чьё решение отвергают. */
  protected readonly rejectHint = computed(() =>
    this.categorySource() === 'Model'
      ? 'Модель об этом описании больше не спросят, пока вы не назначите категорию сами.'
      : 'Прошлое решение по этому описанию перестанет применяться к новым тратам.',
  );

  protected readonly canSave = computed(
    () =>
      !this.isSaving() &&
      this.descriptionError() === null &&
      this.amountError() === null &&
      this.dateError() === null &&
      this.currencyId() !== '',
  );

  constructor() {
    // Разметка применяется сразу, поэтому лист обязан вернуть её странице
    // при любом способе закрытия, включая Escape и клик мимо.
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

  // ------------------------------------------------------------ категория

  protected pickCategory(): void {
    this.sheets
      .openSheet<CategoryPickerResult, CategoryPickerData>(
        CategoryPickerSheet,
        {
          excludedIds: this.category() ? [this.category()!.id] : [],
          rootOptionLabel: this.category() ? 'Убрать категорию' : undefined,
        },
        { ariaLabel: 'Выбор категории' },
      )
      .closed.subscribe((result) => {
        if (!result) {
          return;
        }

        this.isMarkupBusy.set(true);

        const request =
          result.kind === 'new'
            ? this.api.linkSpendingToNewCategory(this.original.id, result.title)
            : this.api.setSpendingCategory(
                this.original.id,
                result.kind === 'root' ? null : result.category.id,
              );

        request.subscribe({
          next: (affected) => {
            // Каскад назначает категорию и тем тратам, у которых её не было,
            // поэтому число сообщается всегда, когда оно ненулевое. Саму
            // правленую трату сервер в него не включает. При снятии категории
            // каскада нет и приходит ноль - молчать тут правильно.
            if (affected > 0) {
              this.toast.info(`Поправлено ещё ${spendingsCount(affected)}`);
            }

            this.refreshMarkup();
          },
          error: () => this.isMarkupBusy.set(false),
        });
      });
  }

  /**
   * Отказ от разметки описания.
   *
   * Массовая операция, поэтому с подтверждением: она снимает категорию со всех
   * трат владельца с этим описанием, кроме размеченных вручную. Отправляется
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
        { excludedIds: this.tags().map((tag) => tag.id) },
        { ariaLabel: 'Выбор тега' },
      )
      .closed.subscribe((result) => {
        if (!result) {
          return;
        }

        this.isMarkupBusy.set(true);

        if (result.kind === 'existing') {
          this.api.setSpendingTag(this.original.id, result.tag.id, true).subscribe({
            next: () => this.refreshMarkup(),
            error: () => this.isMarkupBusy.set(false),
          });

          return;
        }

        // Идентификатор нового тега знает только сервер, поэтому связь
        // навешивается после того, как список тегов перечитан.
        this.api.createTag(result.title).subscribe({
          next: () => this.attachCreatedTag(result.title),
          error: () => this.isMarkupBusy.set(false),
        });
      });
  }

  protected removeTag(tag: Tag): void {
    this.isMarkupBusy.set(true);

    this.api.setSpendingTag(this.original.id, tag.id, false).subscribe({
      next: () => this.refreshMarkup(),
      error: () => this.isMarkupBusy.set(false),
    });
  }

  private attachCreatedTag(title: string): void {
    this.api.getTags().subscribe({
      next: (tags) => {
        const created = tags.find(
          (tag) => tag.title.toLowerCase() === title.toLowerCase(),
        );

        if (!created) {
          this.isMarkupBusy.set(false);
          return;
        }

        this.api.setSpendingTag(this.original.id, created.id, true).subscribe({
          next: () => this.refreshMarkup(),
          error: () => this.isMarkupBusy.set(false),
        });
      },
      error: () => this.isMarkupBusy.set(false),
    });
  }

  /**
   * Перечитывает трату после изменения разметки.
   *
   * Категория и теги приходят с сервера, а не собираются на клиенте: связь
   * может создать новую сущность, идентификатор которой знает только сервер.
   */
  private refreshMarkup(): void {
    this.api.getSpendingById(this.original.id).subscribe({
      next: (spending) => {
        this.category.set(spending.category);
        this.tags.set(spending.tags);
        this.categorySource.set(spending.categorySource);
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
      date: formatInputDate(date),
      category: this.category(),
      tags: this.tags(),
      categorySource: this.categorySource(),
    };

    this.api
      .updateSpending({
        id: updated.id,
        amount: updated.amount,
        currencyId: updated.currencyId,
        date,
        description: updated.description,
      })
      .subscribe({
        next: () => {
          this.telegram.notify('success');
          this.toast.success('Трата сохранена');
          this.dialogRef.close({ kind: 'updated', spending: updated });
        },
        error: () => this.isSaving.set(false),
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

  protected close(): void {
    // Разметка применяется сразу, поэтому даже при отказе от правки полей
    // трату нужно вернуть обновлённой.
    this.dialogRef.close({
      kind: 'updated',
      spending: {
        ...this.original,
        category: this.category(),
        tags: this.tags(),
        categorySource: this.categorySource(),
      },
    });
  }
}

function toInputValue(value: string): string {
  const date = parseCalendarDate(value);
  return date ? formatInputDate(date) : '';
}

/** В поле ввода дробная часть отделяется точкой, без разделителей разрядов. */
function formatAmountForInput(amount: number): string {
  return String(amount);
}
