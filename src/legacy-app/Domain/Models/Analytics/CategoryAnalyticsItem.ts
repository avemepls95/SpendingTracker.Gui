export class CategoryAnalyticsItem {
  categoryId: string;
  categoryTitle: string;
  amount: number;
  childs: CategoryAnalyticsItem[];
  parentIds: string[];

  public constructor(
    fields?: {
      categoryId?: string,
      categoryTitle?: Date,
      amount?: string,
      childs?: string,
      parentIds?: string,
    }) {
    if (fields) Object.assign(this, fields);
  }
}
