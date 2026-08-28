import {UserAccountDto} from "./UserAccountDto";

export class GetUserAccountsResponse {
  totalAmount: number;
  accounts: UserAccountDto[];
}
