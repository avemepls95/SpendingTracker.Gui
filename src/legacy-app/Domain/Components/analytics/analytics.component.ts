import {Component, OnInit} from '@angular/core';
import {SpendingApiService} from "../../Services/spending-api.service";
import {finalize} from "rxjs/operators";
import {LoaderService} from "../../../Common/Services/loader.service";
import {CategoryAnalytics} from "../../Models/Analytics/CategoryAnalytics";
import 'moment/locale/ru';
import {
  MAT_MOMENT_DATE_FORMATS,
  MomentDateAdapter,
  MAT_MOMENT_DATE_ADAPTER_OPTIONS,
} from '@angular/material-moment-adapter';
import {DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE} from '@angular/material/core';
import {MatBottomSheet} from "@angular/material/bottom-sheet";
import {CategorySpendingsComponent} from "./category-spendings/category-spendings.component";
import {GetFilteredSpendingsRequest} from "../../Services/Contracts/GetFilteredSpendingsRequest";
import {UserSettingsStore} from "../../Store/UserSettingsStore";
import {CurrenciesStore} from "../../Store/CurrenciesStore";
import {Currency} from "../../Models/Currency";
import {zip} from "rxjs";

@Component({
  selector: 'app-analytics',
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.scss'],
  providers: [
    {provide: MAT_DATE_LOCALE, useValue: 'ru-RU'},
    {
      provide: DateAdapter,
      useClass: MomentDateAdapter,
      deps: [MAT_DATE_LOCALE, MAT_MOMENT_DATE_ADAPTER_OPTIONS],
    },
    {provide: MAT_DATE_FORMATS, useValue: MAT_MOMENT_DATE_FORMATS},
  ]
})
export class AnalyticsComponent implements OnInit {
  analytics: CategoryAnalytics;

  dateFrom: Date = new Date();
  dateTo: Date = new Date();

  targetCurrency: Currency;

  constructor(
    private spendingApiService: SpendingApiService,
    private loaderService: LoaderService,
    private userSettingsStore: UserSettingsStore,
    private currenciesStore: CurrenciesStore,
    private _bottomSheet: MatBottomSheet
  )
  {
  }

  ngOnInit(): void {
    this.dateFrom.setDate(this.dateFrom.getDate() - 30);
    zip([this.userSettingsStore.settings.value$, this.currenciesStore.currencies.value$])
      .pipe()
      .subscribe(([userSettings, currencies]) => {
        if (!userSettings.viewCurrencyId) {
          return;
        }

        let targetCurrencyId = userSettings.viewCurrencyId;
        this.targetCurrency = currencies.find(c => c.id == targetCurrencyId)!;

        this.loadAnalytics();
      })
  }

  loadAnalytics() {
    if (!this.dateFrom || !this.dateTo) {
      return;
    }

    this.loaderService.show();
    this.spendingApiService.getCategoriesAnalytics(this.dateFrom, this.dateTo, this.targetCurrency.id).pipe(
      finalize(() => this.loaderService.hide())
    ).subscribe(
      (response) => {
        this.analytics = response;
      },
      (error) => console.error(error)
    );
  }

  onCategoryClicked(categoryId: string) {
    this._bottomSheet.open(CategorySpendingsComponent, {
      data: new GetFilteredSpendingsRequest({
        categoryId: categoryId,
        dateFrom: this.dateFrom,
        dateTo: this.dateTo,
        targetCurrencyId: this.targetCurrency.id
      })
    });
  }
}
