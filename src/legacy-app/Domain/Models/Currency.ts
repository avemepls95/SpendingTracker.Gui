export class Currency {
  id: string;
  code: string;
  flagEmojiCode: string;
  title: string

  public constructor(
    fields: {
      id: string,
      code: string,
      flagEmojiCode: string,
      title: string
    }) {
    if (fields) Object.assign(this, fields);
  }
}
