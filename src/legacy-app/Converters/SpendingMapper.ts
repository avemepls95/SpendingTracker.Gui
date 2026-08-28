import {GetSpendingsResponseItem} from "../Domain/Services/Contracts/GetSpendingsResponseItem";
import {Spending} from "../Domain/Models/Spending";
import {CategoryMapper} from "./CategoryMapper";


export class SpendingMapper {
  static convertFromDto(dto: GetSpendingsResponseItem): Spending {
    let categories = dto.categories?.map(c => CategoryMapper.convertFromDto(c));
    return new Spending({
      id: dto.id,
      createDate: dto.createDate,
      currencyId: dto.currencyId,
      amount: dto.amount,
      date: dto.date,
      description: dto.description,
      categories: categories
    });
  }
}
