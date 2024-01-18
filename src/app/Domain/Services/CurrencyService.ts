import {Injectable} from "@angular/core";
import {CurrenciesStore} from "../Store/CurrenciesStore";
import {Currency} from "../Models/Currency";
import { FlagEmojiiConverter } from "../Models/FlagEmojiiConverter";

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {

  protected readonly FlagEmojiiConverter = FlagEmojiiConverter;
  currencyMap = new Map<string, Currency>();

  constructor(
    currenciesStore: CurrenciesStore,
  ) {
    currenciesStore.currencies.value$.subscribe(currencies => {
      currencies.forEach(currency => {
        this.currencyMap.set(currency.id, currency);
      });
    });
  }

  public getIconById(id: string) {
    return FlagEmojiiConverter.getSrcByEmojiCode(this.getById(id).flagEmojiCode);
  }

  public getIconByFlagEmojiCode(code: string) {
    return FlagEmojiiConverter.getSrcByEmojiCode(code);
  }

  public getById(id: string) {
    return this.currencyMap.get(id)!;
  }
}
