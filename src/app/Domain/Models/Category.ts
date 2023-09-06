export class Category {
    id: string;
    createDate: Date;
    title: string;

    public constructor(
        fields?: {
            id?: string,
            createDate?: Date,
            title?: string
        }) {
        if (fields) Object.assign(this, fields);
    }
}
