export class Currency {
  id: string;
  code: string;
  flagEmojiCode: string;
  description: string;
  title: string

  public constructor(
    fields?: {
      id?: string,
      code?: string,
      flagEmojiCode?: string,
      description?: string,
      title?: string
    }) {
    if (fields) Object.assign(this, fields);
  }
}
