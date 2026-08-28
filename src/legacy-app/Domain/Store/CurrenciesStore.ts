import {Injectable} from "@angular/core";
import {BehaviorSubjectItem} from "../../Common/Dispatch/BehaviorSubjectItem";
import {SpendingApiService} from "../Services/spending-api.service";
import {finalize} from "rxjs/operators";
import {LoaderService} from "../../Common/Services/loader.service";
import {Currency} from "../Models/Currency";
import {CurrencyMapper} from "../../Converters/CurrencyMapper";

@Injectable()
export class CurrenciesStore {
  readonly currencies: BehaviorSubjectItem<Currency[]> = new BehaviorSubjectItem([] as Currency[]);

  constructor(
    private spendingApiService: SpendingApiService,
    private loaderService: LoaderService
  ) {
  }

  initialize() {
    this.fetch();
  }

  private fetch() {
    this.loaderService.show();
    this.spendingApiService.getAllCurrencies()
      .pipe(finalize(() => { this.loaderService.hide() }))
      .subscribe(
        response => {
         this.currencies.value = response.map(s => CurrencyMapper.convertFromDto(s));
        }
      );
  }
}
