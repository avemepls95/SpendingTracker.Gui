import {AfterViewInit, Component, LOCALE_ID, OnInit} from '@angular/core';
import {MatDialog} from "@angular/material/dialog";
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
import {forkJoin, Observable, of} from "rxjs";
import {Currency} from "../../Models/Currency";
import {animate, state, style, transition, trigger} from "@angular/animations";
import {Category} from "../../Models/Category";
import {CategoryMapper} from "../../../Converters/CategoryMapper";
import {NgxSpinnerService} from "ngx-spinner";
import {GetSpendingsWithCategoriesTreeRequest} from "../../Services/Contracts/GetSpendingsWithCategoriesTreeRequest";
import localeRu from '@angular/common/locales/ru';
import {registerLocaleData} from "@angular/common";
import {GetSpendingsResponseItem} from "../../Services/Contracts/GetSpendingsResponseItem";
import {CategoryDto} from "../../Services/Contracts/CategoryDto";
import {CurrenciesStore} from "../../Store/CurrenciesStore";
import {CurrencyService} from "../../Services/CurrencyService";

registerLocaleData(localeRu);

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
  providers: [
    { provide: LOCALE_ID, useValue: 'ru' }
  ],
})
export class SpendingsComponent implements OnInit, AfterViewInit {

  dataSource: MatTableDataSource<Spending>;
  spendings: Spending[];
  currencies: Currency[] = [];
  categoriesForSelect: Category[] = [];

  displayedColumns: string[] = ['show-category', 'date', 'amount', 'description', 'currencyCode', 'actions'];
  filtrationPanelIsOpen = false;
  expandedElements: string[] = [];
  onlyWithoutCategories: boolean = false;

  spendingsCategoriesExpandingStates: { [id: string]: { [id: string]: boolean } } = {};

  isLoading: boolean = false;
  private recordsCountToLoad: number = 10;
  private loadedRecordsCount: number = 0;
  searchString: string = '';

  constructor(
    private spendingApiService: SpendingApiService,
    private loaderService: LoaderService,
    private dialog: MatDialog,
    private copyUtils: CopyUtils,
    private spinner: NgxSpinnerService,
    currenciesStore: CurrenciesStore,
    public currencyService: CurrencyService
  ) {
    currenciesStore.currencies.value$.subscribe(value => {
      this.currencies = value;
    })
  }

  loadData() {
    this.loaderService.show();
    let request = this.buildGetSpendingsRequest(0, this.recordsCountToLoad);

    this.spendingApiService.getSpendingsWithCategoriesTree(request)
      .pipe( finalize(() => this.loaderService.hide()))
      .subscribe(
        response => {
          this.spendings = response.map(s => SpendingMapper.convertFromDto(s));
          this.dataSource = new MatTableDataSource(this.spendings);
          this.loadedRecordsCount += response.length;
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

    let countToLoad = this.loadedRecordsCount;
    if (this.onlyWithoutCategories) {
      countToLoad -= 1;
    }

    let categoriesObservable = this.spendingApiService.getCategories();

    let observables: (Observable<GetSpendingsResponseItem[]> | Observable<CategoryDto[]> | Observable<GetSpendingsResponseItem>)[]
      = [categoriesObservable];

    if (countToLoad != 0) {
      let requestModel = this.buildGetSpendingsRequest(0, countToLoad);
      observables.push(this.spendingApiService.getSpendingsWithCategoriesTree(requestModel));
    }
    else{
      observables.push(of([]));
    }

    if (this.onlyWithoutCategories) {
      observables.push(this.spendingApiService.getSpendingById(response.spendingId));
    }

    forkJoin(observables)
      .pipe(finalize(() => this.loaderService.hide()))
      .subscribe(
        ([categoryDtos, spendingDtos, oneSpendingDto]) => {
          let spendingsResponse = (spendingDtos as GetSpendingsResponseItem[]).map(s => SpendingMapper.convertFromDto(s));
          if (this.onlyWithoutCategories) {
            let oneSpendingResponse = SpendingMapper.convertFromDto((oneSpendingDto as GetSpendingsResponseItem));
            spendingsResponse.push(oneSpendingResponse);
            this.spendings = spendingsResponse
              .sort((s1, s2) => new Date(s2.date).getTime() - new Date(s1.date).getTime())
              .sort((s1, s2) => new Date(s2.createDate).getTime() - new Date(s1.createDate).getTime());
          } else {
            this.spendings = spendingsResponse;
          }

          this.dataSource = new MatTableDataSource(this.spendings);
          this.categoriesForSelect = (categoryDtos as CategoryDto[]).map(c => CategoryMapper.convertFromDto(c));
        },
        (error) => console.error(error)
      );
  }

  onScroll(): void {
    if (this.isLoading)
      return;

    this.isLoading = true;
    this.spinner.show();

    let request = this.buildGetSpendingsRequest(this.loadedRecordsCount, this.recordsCountToLoad);
    this.spendingApiService.getSpendingsWithCategoriesTree(request).pipe(
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

        this.loadMoreButtonNotClicked = false;
      },
      (error) => console.error(error)
    );
  }

  loadMoreButtonNotClicked: boolean = true;

  showLoadMoreButton(){
    return this.loadMoreButtonNotClicked && !!this.spendings && this.spendings.length == this.recordsCountToLoad;
  }

  loadMoreSpendings() {
    this.onScroll();
  }

  applyFiltration() {
    this.loadedRecordsCount = 0;
    let request = this.buildGetSpendingsRequest(0, this.recordsCountToLoad);
    this.spendingApiService.getSpendingsWithCategoriesTree(request).pipe(
      finalize(() => {
        this.spinner.hide();
        this.isLoading = false;
      })
    ).subscribe(
      (response) => {
        this.spendings = response.map(s => SpendingMapper.convertFromDto(s));
        this.dataSource = new MatTableDataSource(this.spendings);
        this.loadedRecordsCount += response.length;

        this.loadMoreButtonNotClicked = true;
      },
      (error) => console.error(error)
    );
  }

  buildGetSpendingsRequest(offset: number, count: number): GetSpendingsWithCategoriesTreeRequest {
    return new GetSpendingsWithCategoriesTreeRequest({
      offset: offset,
      count: count,
      searchString: this.searchString,
      onlyWithoutCategories: this.onlyWithoutCategories
    })
  }
}
