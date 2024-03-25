export class UserSettings {
  viewCurrencyId: string;

  public constructor(
    fields: {
      viewCurrencyId: string
    }) {
    if (fields) Object.assign(this, fields);
  }
}
