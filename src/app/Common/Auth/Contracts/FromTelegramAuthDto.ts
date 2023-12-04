export class FromTelegramAuthDto {
  first_name: string;
  hash: string;
  id: number;
  last_name: string;
  photo_url: string;

  public constructor(
    fields?: {
      first_name?: string,
      hash?: string,
      id?: number,
      last_name?: string
      photo_url?: string
    }) {
    if (fields) Object.assign(this, fields);
  }
}
