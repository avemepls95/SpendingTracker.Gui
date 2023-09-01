export class TelegramToBalanceAuthDto {
    authDate: string;
    firstName: string;
    hash: string;
    lastName: string;
    photoUrl: string;
    userId: number;

    public constructor(
        fields?: {
            authDate?: string,
            firstName?: string,
            hash?: string,
            lastName?: string,
            photoUrl?: string
            userId?: number
        }) {
        if (fields) Object.assign(this, fields);
    }
}