export class TelegramAuthDto {
    authDateAsString: string;
    firstName: string;
    hash: string;
    lastName: string;
    photoUrl: string;
    userId: number;
    username: string;

    public constructor(
        fields: {
            authDateAsString: string,
            firstName: string,
            hash: string,
            lastName: string,
            photoUrl: string
            userId: number
            username: string
        }) {
        if (fields) Object.assign(this, fields);
    }
}
