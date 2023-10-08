import {Currency} from "./Currency";

export class Spending {
  id: string;
  amount: number;
  currencyId: string;
  createDate: Date;
  date: Date;
  description: string;

  public constructor(
    fields?: {
      id?: string,
      amount?: number,
      currencyId?: string,
      createDate?: Date,
      date?: Date,
      description?: string,
    }) {
    if (fields) Object.assign(this, fields);
  }
}
