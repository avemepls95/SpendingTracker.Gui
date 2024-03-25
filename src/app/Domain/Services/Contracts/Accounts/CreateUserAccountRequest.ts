import {AccountTypeEnum} from "../../../Models/Accounts/AccountTypeEnum";

export class CreateUserAccountRequest {
  name: string;
  type: AccountTypeEnum;
  currencyId: string;
  amount: number;

  public constructor(
    fields: {
      name: string,
      type: string,
      currencyId: string,
      amount: string
    }) {
    if (fields) Object.assign(this, fields);
  }
}
