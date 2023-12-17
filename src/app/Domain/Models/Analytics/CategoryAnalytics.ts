import {CategoryAnalyticsItem} from "./CategoryAnalyticsItem";

export class CategoryAnalytics {
    totalAmount: number;
    categoryInfos: CategoryAnalyticsItem[];

    public constructor(
        fields?: {
          totalAmount: number,
          childs: CategoryAnalyticsItem[],
        }) {
        if (fields) Object.assign(this, fields);
    }
}
