import {Currency} from "../Domain/Models/Currency";
import {GetAllCurrenciesResponseItem} from "../Domain/Services/Contracts/GetAllCurrenciesResponseItem";


export class CurrencyMapper {
  static convertFromDto(dto: GetAllCurrenciesResponseItem): Currency {
    return new Currency({
      id: dto.id,
      code: dto.code,
      flagEmojiCode: dto.flagEmojiCode,
      description: dto.code,
      title: dto.code,
    })
  }
}
