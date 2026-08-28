import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';

import { SheetService } from '../../core/ui/sheet.service';
import { SpendingApiService } from '../../domain/api/spending-api.service';
import { AccountListItem, AccountsSummary } from '../../domain/models/models';
import { CurrenciesStore } from '../../domain/stores/currencies.store';
import { UserSettingsStore } from '../../domain/stores/user-settings.store';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ACCOUNT_TYPE_ICONS, IconComponent, IconName } from '../../shared/ui/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { AccountEditData, AccountEditResult, AccountEditSheet } from './account-edit.sheet';

type Status = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-accounts-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, EmptyStateComponent, IconComponent, MoneyPipe],
  templateUrl: './accounts.page.html',
  styleUrl: './accounts.page.scss',
})
export class AccountsPage {
  private readonly api = inject(SpendingApiService);
  private readonly sheets = inject(SheetService);
  private readonly settings = inject(UserSettingsStore);
  private readonly currencies = inject(CurrenciesStore);

  protected readonly status = signal<Status>('loading');
  protected readonly summary = signal<AccountsSummary | null>(null);

  protected readonly viewCurrencyCode = computed(() =>
    this.currencies.codeOf(this.settings.viewCurrencyId()),
  );

  protected readonly isEmpty = computed(
    () => this.status() === 'ready' && (this.summary()?.accounts.length ?? 0) === 0,
  );

  constructor() {
    // Перезагрузка при смене валюты отображения. Прежний экран связывал
    // настройки и справочник через zip(): второе значение до него уже не
    // доходило, и суммы обновлялись только после перезагрузки страницы.
    effect(() => {
      const currencyId = this.settings.viewCurrencyId();
      if (currencyId) {
        this.load(currencyId);
      }
    });
  }

  protected iconFor(type: AccountListItem['type']): IconName {
    return ACCOUNT_TYPE_ICONS[type];
  }

  protected currencyCode(currencyId: string): string {
    return this.currencies.codeOf(currencyId);
  }

  /** Сумма показывается второй строкой, только если счёт ведётся в другой валюте. */
  protected needsConversion(account: AccountListItem): boolean {
    return account.originalCurrencyId !== this.settings.viewCurrencyId();
  }

  protected create(): void {
    this.openSheet({ mode: 'create' });
  }

  protected edit(account: AccountListItem): void {
    this.openSheet({
      mode: 'edit',
      account: {
        id: account.id,
        name: account.name,
        type: account.type,
        currencyId: account.originalCurrencyId,
        amount: account.originalCurrencyAmount,
      },
    });
  }

  protected retry(): void {
    const currencyId = this.settings.viewCurrencyId();
    if (currencyId) {
      this.load(currencyId);
    }
  }

  private openSheet(data: AccountEditData): void {
    this.sheets
      .openSheet<AccountEditResult, AccountEditData>(AccountEditSheet, data)
      .closed.subscribe((result) => {
        // Закрытие по Escape или клику мимо возвращает undefined. Прежний код
        // сразу читал result.action и падал на этом.
        if (result?.kind === 'changed') {
          this.retry();
        }
      });
  }

  private load(currencyId: string): void {
    this.status.set('loading');

    this.api.getAccounts(currencyId).subscribe({
      next: (summary) => {
        this.summary.set({
          ...summary,
          accounts: [...summary.accounts].sort(
            (left, right) => right.targetCurrencyAmount - left.targetCurrencyAmount,
          ),
        });
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }
}
