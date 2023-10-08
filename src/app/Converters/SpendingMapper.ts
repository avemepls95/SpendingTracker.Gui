import {GetSpendingsResponseItem} from "../Domain/Services/Contracts/GetSpendingsResponseItem";
import {Spending} from "../Domain/Models/Spending";


export class SpendingMapper {
  static convertFromDto(dto: GetSpendingsResponseItem): Spending {
    return new Spending({
      id: dto.id,
      createDate: dto.createDate,
      currencyId: dto.currencyId,
      amount: dto.amount,
      date: dto.date,
      description: dto.description
    })
  }
}
