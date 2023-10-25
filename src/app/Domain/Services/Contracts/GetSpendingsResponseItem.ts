import {CategoryDto} from "./CategoryDto";

export class GetSpendingsResponseItem {
    id: string;
    amount: number;
    currencyId: string;
    createDate: Date;
    date: Date;
    description: string;
    categories: CategoryDto[];
}
