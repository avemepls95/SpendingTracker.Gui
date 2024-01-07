export class TelegramAuthDto {
  firstName: string;
  lastName: string;
  userId: number;
  username: string;
  checkString: string;
  authType: string;

  public constructor(
    fields: {
      firstName: string,
      lastName: string,
      userId: number
      username: string
      checkString: string
      authType: string
    }) {
    if (fields) Object.assign(this, fields);
  }
}
