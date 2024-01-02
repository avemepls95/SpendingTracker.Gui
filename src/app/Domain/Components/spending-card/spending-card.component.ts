import {Component, Inject, OnDestroy, OnInit, Optional, ViewChild} from '@angular/core';
import {Spending} from "../../Models/Spending";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {Currency} from "../../Models/Currency";
import {FormControl} from "@angular/forms";
import {ReplaySubject, Subject, takeUntil} from "rxjs";
import {MatSelect} from "@angular/material/select";

@Component({
  selector: 'app-spending-card',
  templateUrl: './spending-card.component.html',
  styleUrls: ['./spending-card.component.scss']
})
export class SpendingCardComponent implements OnInit, OnDestroy {
  spending: Spending;

  selectedCurrencyId: string;
  currencies: Currency[] = [];

  public currencyFilterCtrl: FormControl = new FormControl();
  protected _onDestroy = new Subject<void>();
  public filteredCurrencies: ReplaySubject<Currency[]> = new ReplaySubject<Currency[]>(1);
  @ViewChild('singleSelect') singleSelect: MatSelect;

  constructor(
    public dialogRef: MatDialogRef<SpendingCardComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: any,
    // private spendingApiService: SpendingApiService
  ) {
    this.spending = new Spending(data.spending);
    this.currencies = data.currencies;
    this.selectedCurrencyId = this.spending.currencyId;
  }

  ngOnInit() {
    // load the initial bank list
    this.filteredCurrencies.next(this.currencies.slice());

    // listen for search field value changes
    this.currencyFilterCtrl.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe(() => {
        this.filterCurrencies();
      });
  }

  ngOnDestroy() {
    this._onDestroy.next();
    this._onDestroy.complete();
  }

  save() {
    this.spending.currencyId = this.selectedCurrencyId;
    this.dialogRef.close({ data: this.spending });
  }

  closeDialog() {
    this.dialogRef.close('Cancel');
  }

  canBeCreated(): boolean {
    return this.spending.description != null
      && this.spending.description != ''

      && !isNaN(this.spending.amount)
      && this.spending.amount != 0

      && this.spending.date != null

      && this.selectedCurrencyId != null;
  }

  protected filterCurrencies() {
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
      this.currencies.filter(bank => bank.code.toLowerCase().indexOf(search) > -1)
    );
  }
}
