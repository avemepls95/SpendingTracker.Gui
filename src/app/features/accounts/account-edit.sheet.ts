import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { SheetService } from '../../core/ui/sheet.service';
import { TelegramService } from '../../core/telegram/telegram.service';
import { ToastService } from '../../core/ui/toast.service';
import { SpendingApiService } from '../../domain/api/spending-api.service';
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  AccountType,
  Currency,
  UserAccount,
} from '../../domain/models/models';
import { confirmAction } from '../../shared/ui/confirm.dialog';
import {
  CurrencyPickerData,
  CurrencyPickerSheet,
} from '../../shared/ui/currency-picker.sheet';
import { ACCOUNT_TYPE_ICONS, IconComponent, IconName } from '../../shared/ui/icon.component';
import { CurrenciesStore } from '../../domain/stores/currencies.store';
import { parseAmount } from '../../shared/util/money.util';

export type AccountEditData =
  | { readonly mode: 'create' }
  | { readonly mode: 'edit'; readonly account: UserAccount };

export type AccountEditResult = { readonly kind: 'changed' };

@Component({
  selector: 'app-account-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './account-edit.sheet.html',
  styleUrl: './account-edit.sheet.scss',
})
export class AccountEditSheet {
  private readonly data = inject<AccountEditData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<AccountEditResult>>(DialogRef);
  private readonly api = inject(SpendingApiService);
  private readonly sheets = inject(SheetService);
  private readonly telegram = inject(TelegramService);
  private readonly toast = inject(ToastService);
  private readonly currencies = inject(CurrenciesStore);

  private readonly existing = this.data.mode === 'edit' ? this.data.account : null;

  protected readonly isEdit = this.existing !== null;
  protected readonly title = this.isEdit ? 'Счёт' : 'Новый счёт';

  protected readonly name = signal(this.existing?.name ?? '');
  protected readonly amountText = signal(
    this.existing ? String(this.existing.amount) : '',
  );
  protected readonly currencyId = signal(this.existing?.currencyId ?? '');
  protected readonly type = signal<AccountType>(this.existing?.type ?? 'DebitCard');
  protected readonly isSaving = signal(false);

  protected readonly accountTypes = ACCOUNT_TYPES;
  protected readonly typeLabels = ACCOUNT_TYPE_LABELS;

  protected readonly amount = computed(() => parseAmount(this.amountText()));

  protected readonly currencyCode = computed(
    () => this.currencies.find(this.currencyId())?.code ?? 'Выбрать',
  );

  protected readonly nameError = computed(() =>
    this.name().trim() === '' ? 'Укажите название' : null,
  );

  /**
   * Сумма проверяется только на то, что это число.
   *
   * Прежняя форма требовала amount > 0, поэтому нельзя было завести ни
   * кредитную карту с долгом, ни пустой счёт с нулём.
   */
  protected readonly amountError = computed(() =>
    this.amount() === null ? 'Введите сумму числом' : null,
  );

  protected readonly canSave = computed(
    () =>
      !this.isSaving() &&
      this.nameError() === null &&
      this.amountError() === null &&
      this.currencyId() !== '',
  );

  protected iconFor(type: AccountType): IconName {
    return ACCOUNT_TYPE_ICONS[type];
  }

  protected onName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  protected onAmount(event: Event): void {
    this.amountText.set((event.target as HTMLInputElement).value);
  }

  protected selectType(type: AccountType): void {
    this.type.set(type);
    this.telegram.selectionChanged();
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

  protected save(): void {
    const amount = this.amount();
    if (!this.canSave() || amount === null) {
      return;
    }

    this.isSaving.set(true);

    const payload = {
      name: this.name().trim(),
      type: this.type(),
      currencyId: this.currencyId(),
      amount,
    };

    const request = this.existing
      ? this.api.updateAccount({ ...payload, id: this.existing.id })
      : this.api.createAccount(payload);

    request.subscribe({
      next: () => {
        this.telegram.notify('success');
        this.toast.success(this.isEdit ? 'Счёт сохранён' : 'Счёт добавлен');
        this.dialogRef.close({ kind: 'changed' });
      },
      error: () => this.isSaving.set(false),
    });
  }

  protected async remove(): Promise<void> {
    const account = this.existing;
    if (!account) {
      return;
    }

    const confirmed = await confirmAction(this.sheets, this.telegram, {
      title: 'Удалить счёт?',
      message: `«${account.name}» исчезнет из списка и перестанет учитываться в общем балансе.`,
      confirmLabel: 'Удалить',
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    this.isSaving.set(true);
    this.api.deleteAccount(account.id).subscribe({
      next: () => {
        this.telegram.notify('success');
        this.dialogRef.close({ kind: 'changed' });
      },
      error: () => this.isSaving.set(false),
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
