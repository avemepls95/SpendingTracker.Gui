export class FromTelegramAuthDto {
  auth_date: string;
  first_name: string;
  hash: string;
  id: number;
  last_name: string;
  photo_url: string;
  username: string;

  public constructor(
    fields: {
      auth_date: string,
      first_name: string,
      hash: string,
      id: number,
      last_name: string
      photo_url: string
      username: string
    }) {
    if (fields) Object.assign(this, fields);
  }
}
