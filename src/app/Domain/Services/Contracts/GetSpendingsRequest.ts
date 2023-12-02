export class GetSpendingsRequest {
  offset: number;
  count: number;
  searchString: string;
  onlyWithoutCategories: boolean;

  public constructor(
    fields?: {
      offset?: number,
      count?: number,
      searchString?: string,
      onlyWithoutCategories?: boolean
    }) {
    if (fields) Object.assign(this, fields);
  }
}
