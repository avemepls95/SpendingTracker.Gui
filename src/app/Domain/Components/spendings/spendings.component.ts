import {AfterViewInit, Component, ElementRef, HostListener, Input, OnInit, ViewChild} from '@angular/core';
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
import {animate, state, style, transition, trigger} from "@angular/animations";
import {Category} from "../../Models/Category";
import {CategoryMapper} from "../../../Converters/CategoryMapper";
import {NgxSpinnerService} from "ngx-spinner";

@Component({
  selector: 'app-spendings',
  templateUrl: './spendings.component.html',
  styleUrls: ['./spendings.component.scss'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({height: '0px', minHeight: '0'})),
      state('expanded', style({height: '*'})),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
})
export class SpendingsComponent implements OnInit, AfterViewInit {

  dataSource: MatTableDataSource<Spending>;
  spendings: Spending[];
  currencies: Currency[] = [];
  categoriesForSelect: Category[] = [];

  currencyMap = new Map<string, Currency>();

  displayedColumns: string[] = ['show-category', 'date', 'amount', 'description', 'currencyCode', 'actions'];

  expandedElements: string[] = [];

  spendingsCategoriesExpandingStates: { [id: string]: { [id: string]: boolean } } = {};

  isLoading: boolean = false;
  private recordsCountToShowInitially: number = 10;
  private recordsCountToLoad: number = 10;
  private loadedRecordsCount: number = 0;

  protected readonly FlagEmojiiConverter = FlagEmojiiConverter;

  constructor(
    private spendingApiService: SpendingApiService,
    private loaderService: LoaderService,
    private dialog: MatDialog,
    private copyUtils: CopyUtils,
    private spinner: NgxSpinnerService
  ) {
  }

  loadData() {
    this.loaderService.show();
    let spendingsObservable = this.spendingApiService.getSpendings(0, this.recordsCountToShowInitially);
    let currenciesObservable = this.spendingApiService.getAllCurrencies();

    forkJoin([spendingsObservable, currenciesObservable])
      .pipe(
        finalize(() => this.loaderService.hide())
      )
      .subscribe(
        responses => {
          this.spendings = responses[0].map(s => SpendingMapper.convertFromDto(s));
          this.dataSource = new MatTableDataSource(this.spendings);
          this.loadedRecordsCount += responses[0].length;

          this.currencies = responses[1].map(s => CurrencyMapper.convertFromDto(s));
          this.currencies.forEach(currency => {
            this.currencyMap.set(currency.id, currency);
          });
        },
        (error) => console.error(error)
      );
  }

  deleteSpending(id: string) {
    const index = this.spendings.findIndex(c => c.id === id);
    if (index == -1) {
      console.log("Invalid check id:" + id);
    }

    const dialogData = new ConfirmDialogModel('Подтверждение', 'Вы уверены, что хотите удалить трату?');
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      maxWidth: "420px",
      height: "160px",
      data: dialogData
    });

    dialogRef.afterClosed().subscribe(dialogResult => {
      if (!dialogResult)
        return;

      this.loaderService.show();
      this.spendingApiService.deleteSpending(id)
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
            console.log('Invalid spending id:' + spending.id);
          }
          this.spendings[index] = spending;
          this.dataSource.data = this.spendings;
        }
      );
  }

  ngOnInit(): void {
    this.loadData();
  }

  ngAfterViewInit(): void {
    this.spendingApiService.getCategories().pipe(
    ).subscribe(
      (response) => {
        this.categoriesForSelect = response.map(c => CategoryMapper.convertFromDto(c));
      },
      (error) => console.error(error)
    );
  }

  toggleExpand(spending: Spending) {
    let expandedSpendingId = this.expandedElements.find(id => id == spending.id);
    if (!!expandedSpendingId) {
      let index = this.expandedElements.indexOf(expandedSpendingId);
      this.expandedElements.splice(index, 1);
    } else {
      this.expandedElements.push(spending.id);
    }
  }

  onCategoriesUpdated({response}: { response: any }) {
    this.spendingsCategoriesExpandingStates[response.spendingId] = response.categoriesExpandingStates;
    this.loaderService.show();

    let spendingsObservable = this.spendingApiService.getSpendings(0, this.loadedRecordsCount);
    let categoriesObservable = this.spendingApiService.getCategories();

    forkJoin([spendingsObservable, categoriesObservable])
      .pipe(
        finalize(() => this.loaderService.hide())
      )
      .subscribe(
        responses => {
          this.spendings = responses[0].map(s => SpendingMapper.convertFromDto(s));
          this.dataSource = new MatTableDataSource(this.spendings);
          this.categoriesForSelect = responses[1].map(c => CategoryMapper.convertFromDto(c));
        },
        (error) => console.error(error)
      );
  }

  onScroll(): void {
    if (this.isLoading)
      return;

    this.isLoading = true;
    this.spinner.show();

    this.spendingApiService.getSpendings(this.loadedRecordsCount, this.recordsCountToLoad).pipe(
      finalize(() => {
        this.spinner.hide();
        this.isLoading = false;
      })
    ).subscribe(
      (response) => {
        let responseSpendings = response.map(s => SpendingMapper.convertFromDto(s));
        this.spendings = this.spendings.concat(responseSpendings);
        this.dataSource = new MatTableDataSource(this.spendings);
        this.loadedRecordsCount += response.length;

        this.loadMoreButtonClickedOnce = false;
      },
      (error) => console.error(error)
    );
  }

  loadMoreButtonClickedOnce: boolean = true;

  showLoadMoreButton(){
    return this.loadMoreButtonClickedOnce && !!this.spendings && this.spendings.length !=0;
  }

  loadMoreSpendings() {
    this.onScroll();
  }
}
