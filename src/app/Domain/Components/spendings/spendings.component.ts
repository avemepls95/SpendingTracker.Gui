import {Component, ElementRef, ViewChild} from '@angular/core';
import {MatDialog, MatDialogRef} from "@angular/material/dialog";
import {MatTableDataSource} from "@angular/material/table";
import {SpendingApiService} from "../../Services/spending-api.service";
import {LoaderService} from "../../../Common/Services/loader.service";
import {finalize} from "rxjs/operators";
import {
  ConfirmDialogComponent,
  ConfirmDialogModel
} from "../../../Common/Components/confirm-dialog/confirm-dialog.component";
import {SpendingMapper} from "../../../Converters/SpendingMapper";
import {Spending} from "../../Models/Spending";
import {CopyUtils} from "../../../Common/Utils/CopyUtils";
import {SpendingCardComponent} from "../spending-card/spending-card.component";
import {FlagEmojiiConverter} from "../../Models/FlagEmojiiConverter";
import {forkJoin} from "rxjs";
import {Currency} from "../../Models/Currency";
import {CurrencyMapper} from "../../../Converters/CurrencyMapper";
import {GetAllCurrenciesResponseItem} from "../../Services/Contracts/GetAllCurrenciesResponseItem";

@Component({
  selector: 'app-spendings',
  templateUrl: './spendings.component.html',
  styleUrls: ['./spendings.component.scss']
})
export class SpendingsComponent {

  dataSource: MatTableDataSource<Spending>;
  spendings: Spending[] = [];
  currencies: Currency[] = [];

  currencyMap = new Map<string, Currency>();

  displayedColumns: string[] = ['date', 'amount', 'description', 'currencyCode', 'actions'];

  protected readonly FlagEmojiiConverter = FlagEmojiiConverter;

  constructor(
    private spendingApiService: SpendingApiService,
    private loaderService: LoaderService,
    private dialog: MatDialog,
    private copyUtils: CopyUtils
  ) {
    this.loadData();
  }

  loadData(){
    this.loaderService.show();
    let spendingsObservable = this.spendingApiService.getSpendings();
    let currenciesObservable = this.spendingApiService.getAllCurrencies();

    forkJoin([spendingsObservable, currenciesObservable])
      .pipe(
        finalize(() => this.loaderService.hide())
      )
      .subscribe(
        responses => {
          this.spendings = responses[0].map(s => SpendingMapper.convertFromDto(s));
          this.dataSource = new MatTableDataSource(this.spendings);

          this.currencies = responses[1].map(s => CurrencyMapper.convertFromDto(s));

          this.spendings.forEach(spending=> {
            if (!this.currencyMap.has(spending.currencyId)){
              let currency = this.currencies.find(c => c.id == spending.currencyId) as Currency;
              this.currencyMap.set(spending.currencyId, currency);
            }
          });

        },
        (error) => console.error(error)
      );

    // this.spendingApiService.getSpendings().pipe(
    //   finalize(() => this.loaderService.hide())
    // ).subscribe(
    //   (response) => {
    //     this.spendings = response.map(s => SpendingMapper.convertFromDto(s));
    //     this.dataSource = new MatTableDataSource(this.spendings);
    //   },
    //   (error) => console.error(error)
    // );
  }

  deleteSpending(id: string) {
    const index = this.spendings.findIndex(c => c.id === id);
    if (index == -1) {
      console.log("Invalid check id:" + id);
    }

    const dialogData = new ConfirmDialogModel('Подтверждение', 'Вы уверены, что хотите удалить категорию?');
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      maxWidth: "420px",
      height: "160px",
      data: dialogData
    });

    dialogRef.afterClosed().subscribe(dialogResult => {
      if (!dialogResult)
        return;

      this.loaderService.show();
      this.spendingApiService.deleteCategory(id)
        .pipe(finalize(() => {
          this.loaderService.hide();
        }))
        .subscribe(
          (response) => {
            this.spendings.splice(index, 1)[0];
            this.dataSource.data = this.spendings;
          }
        );
    });
  }

  openSpendingCard(spending: Spending) {
    let data = {
      spending: this.copyUtils.deepCopy(spending),
      currencies: this.currencies
    }

    const dialogRef = this.dialog.open(SpendingCardComponent, {
      width: '370px',
      data: data
    });

    dialogRef.afterClosed().subscribe((result = 'Cancel') => {
      if (result != 'Cancel') {
        this.updateSpending(result.data);
      }
    });
  }

  updateSpending(spending: Spending) {
    this.loaderService.show();
    this.spendingApiService.updateSpending(spending)
      .pipe(finalize(() => {
        this.loaderService.hide();
      }))
      .subscribe(
        (response) => {
          const index = this.spendings.findIndex(p => p.id === spending.id);
          if (index == -1) {
            console.log('Invalid spending id:' + spending);
          }
          this.spendings[index] = spending;
          this.dataSource.data = this.spendings;
        }
      );
  }
}
