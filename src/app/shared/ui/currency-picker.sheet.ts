import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { flagImageUrl } from '../../domain/currency/flag.util';
import { Currency } from '../../domain/models/models';
import { CurrenciesStore } from '../../domain/stores/currencies.store';
import { IconComponent } from './icon.component';
import { HideOnErrorDirective } from '../util/hide-on-error.directive';
import { SwipeToCloseDirective } from '../util/swipe-to-close.directive';

export interface CurrencyPickerData {
  readonly selectedId: string;
}

/**
 * Выбор валюты.
 *
 * Заменяет mat-select с ngx-mat-select-search: на телефоне выпадающий список
 * открывался поверх поля и оставлял под себя треть экрана.
 */
@Component({
  selector: 'app-currency-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, HideOnErrorDirective, SwipeToCloseDirective],
  template: `
    <div class="sheet" appSwipeToClose (dismissed)="close()">
      <div class="sheet__grabber" aria-hidden="true"></div>

      <div class="sheet__header">
        <h2 class="sheet__title">Валюта</h2>
        <button type="button" class="icon-btn" aria-label="Закрыть" (click)="close()">
          <app-icon name="close" />
        </button>
      </div>

      <div class="picker__search">
        <app-icon class="picker__search-icon" name="search" />
        <input
          class="field__control picker__search-input"
          type="search"
          placeholder="Код или название"
          autocomplete="off"
          [value]="query()"
          (input)="onQuery($event)"
        />
      </div>

      <div class="sheet__body">
        @if (visible().length === 0) {
          <p class="picker__empty text-2">Ничего не нашлось</p>
        } @else {
          <div class="panel panel--bordered">
            @for (currency of visible(); track currency.id) {
              <button
                type="button"
                class="panel__row"
                [class.picker__row--selected]="currency.id === data.selectedId"
                (click)="select(currency)"
              >
                @if (flagUrl(currency); as url) {
                  <img
                    class="picker__flag"
                    appHideOnError
                    [src]="url"
                    width="24"
                    height="18"
                    alt=""
                    loading="lazy"
                  />
                } @else {
                  <span class="picker__flag picker__flag--blank" aria-hidden="true"></span>
                }
                <span class="picker__code">{{ currency.code }}</span>
                <span class="picker__title truncate text-2">{{ currency.title }}</span>
                @if (currency.id === data.selectedId) {
                  <app-icon class="picker__check" name="check" />
                }
              </button>
            }
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './currency-picker.sheet.scss',
})
export class CurrencyPickerSheet {
  protected readonly data = inject<CurrencyPickerData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<Currency>>(DialogRef);
  private readonly currencies = inject(CurrenciesStore);

  protected readonly query = signal('');

  protected readonly visible = computed(() => {
    const needle = this.query().trim().toLowerCase();
    const all = this.currencies.currencies();
    if (!needle) {
      return all;
    }

    return all.filter(
      (currency) =>
        currency.code.toLowerCase().includes(needle) ||
        currency.title.toLowerCase().includes(needle),
    );
  });

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected flagUrl(currency: Currency): string | null {
    return flagImageUrl(currency.flagEmojiCode);
  }

  protected select(currency: Currency): void {
    this.dialogRef.close(currency);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
