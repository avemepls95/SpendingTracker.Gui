import {Component, Inject, LOCALE_ID, OnInit} from '@angular/core';
import {MAT_BOTTOM_SHEET_DATA} from "@angular/material/bottom-sheet";
import {Spending} from "../../../Models/Spending";
import {finalize} from "rxjs/operators";
import {SpendingMapper} from "../../../../Converters/SpendingMapper";
import {SpendingApiService} from "../../../Services/spending-api.service";
import {LoaderService} from "../../../../Common/Services/loader.service";
import {GetFilteredSpendingsRequest} from "../../../Services/Contracts/GetFilteredSpendingsRequest";
import { registerLocaleData } from '@angular/common';
import localeRu from '@angular/common/locales/ru';

registerLocaleData(localeRu, 'ru');

@Component({
  selector: 'app-notifications-info',
  templateUrl: './category-spendings.component.html',
  styleUrls: ['./category-spendings.component.css'],
  providers: [
    { provide: LOCALE_ID, useValue: 'ru' }
  ]
})
export class CategorySpendingsComponent implements OnInit {
  spendings: Spending[];

  displayedColumns: string[] = ['date', 'description', 'amount'];

  constructor(
    private spendingApiService: SpendingApiService,
    private loaderService: LoaderService,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: GetFilteredSpendingsRequest) { }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loaderService.show();
    this.spendingApiService.getFilteredSpendings(this.data).pipe(
      finalize(() => this.loaderService.hide())
    ).subscribe(
      (response) => {
        this.spendings = response.map(c => SpendingMapper.convertFromDto(c));
      },
      (error) => console.error(error)
    );
  }
}
