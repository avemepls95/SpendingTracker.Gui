export class Category {
    id: string;
    createDate: Date;
    title: string;
    parents: Category[];

    public constructor(
        fields?: {
            id?: string,
            createDate?: Date,
            title?: string,
            parents?: Category[]
        }) {
        if (fields) Object.assign(this, fields);
    }
}
