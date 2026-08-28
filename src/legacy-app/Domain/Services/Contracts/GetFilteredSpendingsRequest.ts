export class GetFilteredSpendingsRequest {
  targetCurrencyId: string;
  categoryId: string;
  dateFrom: Date;
  dateTo: Date;

  public constructor(
    fields?: {
      targetCurrencyId?: string,
      categoryId?: string,
      dateFrom: Date,
      dateTo: Date
    }) {
    if (fields) Object.assign(this, fields);
  }
}
