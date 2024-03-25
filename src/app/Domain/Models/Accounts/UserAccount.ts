import {AccountTypeEnum} from "./AccountTypeEnum";

export class UserAccount {
  id: string;
  name: string;
  type: AccountTypeEnum;
  currencyId: string;
  amount: number;

  public constructor(
    fields?: {
      id: string,
      name: string,
      type: AccountTypeEnum,
      currencyId: string,
      amount: number
    }) {
    if (fields) Object.assign(this, fields);
  }
}
