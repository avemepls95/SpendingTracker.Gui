import {Category} from "./Category";

export class Spending {
  id: string;
  amount: number;
  currencyId: string;
  createDate: Date;
  date: Date;
  description: string;
  categories: Category[];

  public constructor(
    fields?: {
      id?: string,
      amount?: number,
      currencyId?: string,
      createDate?: Date,
      date?: Date,
      description?: string,
      categories: Category[]
    }) {
    if (fields) Object.assign(this, fields);
  }
}
