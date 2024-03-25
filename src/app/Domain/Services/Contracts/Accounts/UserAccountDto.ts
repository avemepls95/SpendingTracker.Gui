import {AccountTypeEnum} from "../../../Models/Accounts/AccountTypeEnum";

export class UserAccountDto {
  id: string;
  name: string;
  type: AccountTypeEnum;
  originalCurrencyId: string;
  originalCurrencyAmount: number;
  targetCurrencyAmount: number;
}
