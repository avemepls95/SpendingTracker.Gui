import {Component, LOCALE_ID, OnInit} from '@angular/core';
import {UserSettings} from "../../Models/UserSettings";
import {UserSettingsStore} from "../../Store/UserSettingsStore";
import {CurrenciesStore} from "../../Store/CurrenciesStore";
import {Currency} from "../../Models/Currency";
import {ReplaySubject, Subject, takeUntil, zip} from "rxjs";
import {FlagEmojiiConverter} from "../../Models/FlagEmojiiConverter";
import {FormControl} from "@angular/forms";
import {MatSelectChange} from "@angular/material/select";

@Component({
  selector: 'app-user-settings',
  templateUrl: './user-settings.component.html',
  styleUrls: ['./user-settings.component.scss'],
  providers: [
    { provide: LOCALE_ID, useValue: 'ru' }
  ]
})
export class UserSettingsComponent implements OnInit {

  settings: UserSettings;
  currencies: Currency[];

  currentCurrency: Currency;

  public currencyFilterCtrl: FormControl = new FormControl();
  public filteredCurrencies: ReplaySubject<Currency[]> = new ReplaySubject<Currency[]>(1);
  protected _onDestroy = new Subject<void>();

  constructor(
    private userSettingsStore: UserSettingsStore,
    private currenciesStore: CurrenciesStore
  ) {
    zip([this.userSettingsStore.settings.value$, this.currenciesStore.currencies.value$])
      .pipe()
      .subscribe(([userSettings, currencies]) => {
        this.settings = Object.assign({}, userSettings);
        this.currencies = currencies;
        this.filteredCurrencies.next(this.currencies.slice());

        this.currentCurrency = this.currencies.find(c => c.id == this.settings.viewCurrencyId)!;
      })
  }

  ngOnInit(): void {
    this.currencyFilterCtrl.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe(() => {
        this.filterCurrencies();
      });
  }

  protected readonly FlagEmojiiConverter = FlagEmojiiConverter;

  private filterCurrencies() {
    if (!this.currencies) {
      return;
    }

    let search = this.currencyFilterCtrl.value;
    if (!search) {
      this.filteredCurrencies.next(this.currencies.slice());
      return;
    } else {
      search = search.toLowerCase();
    }

    this.filteredCurrencies.next(
      this.currencies.filter(currency => currency.code.toLowerCase().indexOf(search) > -1)
    );
  }

  changeCurrency($event: MatSelectChange) {
    this.currentCurrency = this.currencies.find(c => c.id == $event.value)!;
    this.settings.viewCurrencyId = this.currentCurrency.id;
  }

  save() {
    this.userSettingsStore.set(this.settings);
  }
}
