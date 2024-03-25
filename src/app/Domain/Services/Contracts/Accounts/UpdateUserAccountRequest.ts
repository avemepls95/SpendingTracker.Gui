import {AccountTypeEnum} from "../../../Models/Accounts/AccountTypeEnum";

export class UpdateUserAccountRequest {
  id: string;
  name: string;
  type: AccountTypeEnum;
  currencyId: string;
  amount: number;

  public constructor(
    fields: {
      id: string;
      name: string,
      type: string,
      currencyId: string,
      amount: string
    }) {
    if (fields) Object.assign(this, fields);
  }
}
