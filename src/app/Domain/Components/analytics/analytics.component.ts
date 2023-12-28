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

  targetCurrencyId: string = '17d5494d-d969-465d-b5cc-16979e3fe5f8';

  constructor(
    private spendingApiService: SpendingApiService,
    private loaderService: LoaderService,
    private _bottomSheet: MatBottomSheet
  )
  {
  }

  ngOnInit(): void {
    this.dateFrom.setDate(this.dateFrom.getDate() - 30);
    this.loadAnalytics();
  }

  loadAnalytics() {
    if (!this.dateFrom || !this.dateTo) {
      return;
    }

    this.loaderService.show();
    this.spendingApiService.getCategoriesAnalytics(this.dateFrom, this.dateTo, this.targetCurrencyId).pipe(
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
        targetCurrencyId: this.targetCurrencyId
      })
    });
  }
}
