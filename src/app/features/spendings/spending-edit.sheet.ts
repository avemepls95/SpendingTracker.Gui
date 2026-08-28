import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { SheetService } from '../../core/ui/sheet.service';
import { TelegramService } from '../../core/telegram/telegram.service';
import { ToastService } from '../../core/ui/toast.service';
import { SpendingApiService } from '../../domain/api/spending-api.service';
import { Category, Currency, Spending } from '../../domain/models/models';
import { CurrenciesStore } from '../../domain/stores/currencies.store';
import { confirmAction } from '../../shared/ui/confirm.dialog';
import {
  CurrencyPickerData,
  CurrencyPickerSheet,
} from '../../shared/ui/currency-picker.sheet';
import { IconComponent } from '../../shared/ui/icon.component';
import {
  formatInputDate,
  parseCalendarDate,
} from '../../shared/util/date.util';
import { parseAmount } from '../../shared/util/money.util';
import {
  CategoryPickerData,
  CategoryPickerResult,
  CategoryPickerSheet,
} from '../../shared/ui/category-picker.sheet';

export type SpendingEditResult =
  | { readonly kind: 'updated'; readonly spending: Spending }
  | { readonly kind: 'deleted'; readonly id: string };

@Component({
  selector: 'app-spending-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
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

  /** Категории меняются отдельными запросами и применяются сразу. */
  protected readonly categories = signal<readonly Category[]>(this.original.categories);

  protected readonly isSaving = signal(false);
  protected readonly isCategoryBusy = signal(false);

  protected readonly amount = computed(() => parseAmount(this.amountText()));

  protected readonly currencyCode = computed(
    () => this.currencies.find(this.currencyId())?.code ?? 'Выбрать',
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

  protected readonly canSave = computed(
    () =>
      !this.isSaving() &&
      this.descriptionError() === null &&
      this.amountError() === null &&
      this.dateError() === null &&
      this.currencyId() !== '',
  );

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
      .openSheet<Currency, CurrencyPickerData>(CurrencyPickerSheet, {
        selectedId: this.currencyId(),
      })
      .closed.subscribe((currency) => {
        if (currency) {
          this.currencyId.set(currency.id);
        }
      });
  }

  // ------------------------------------------------------------ категории

  protected addCategory(): void {
    this.sheets
      .openSheet<CategoryPickerResult, CategoryPickerData>(CategoryPickerSheet, {
        excludedIds: this.categories().map((category) => category.id),
      })
      .closed.subscribe((result) => {
        if (!result) {
          return;
        }

        this.isCategoryBusy.set(true);

        const request =
          result.kind === 'existing'
            ? this.api.linkSpendingToCategory(this.original.id, result.category.id)
            : this.api.linkSpendingToNewCategory(this.original.id, result.title);

        request.subscribe({
          next: () => this.refreshCategories(),
          error: () => this.isCategoryBusy.set(false),
        });
      });
  }

  protected removeCategory(category: Category): void {
    this.isCategoryBusy.set(true);

    this.api.unlinkSpendingFromCategory(this.original.id, category.id).subscribe({
      next: () => this.refreshCategories(),
      error: () => this.isCategoryBusy.set(false),
    });
  }

  /**
   * Перечитывает трату после изменения связей.
   *
   * Список категорий приходит с сервера, а не собирается на клиенте: связь
   * может создать новую категорию, идентификатор которой знает только сервер.
   */
  private refreshCategories(): void {
    this.api.getSpendingById(this.original.id).subscribe({
      next: (spending) => {
        this.categories.set(spending.categories);
        this.isCategoryBusy.set(false);
        this.telegram.impact('light');
      },
      error: () => this.isCategoryBusy.set(false),
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
      categories: this.categories(),
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
    // Категории применяются сразу, поэтому даже при отказе от правки полей
    // список нужно вернуть обновлённым.
    this.dialogRef.close({
      kind: 'updated',
      spending: { ...this.original, categories: this.categories() },
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
