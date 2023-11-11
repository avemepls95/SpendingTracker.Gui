
export class ErrorCodeMessages {
  private static _instance: ErrorCodeMessages;

  private dictionary: { [id: string]: string } = {};

  public static get Instance()
  {
    return this._instance || (this._instance = new this());
  }

  constructor() {
    this.dictionary['RecursivelyAddedCategory'] = 'Невозможно связать категории, так как они уже связаны в обратную сторону';
    this.dictionary['CategoriesAlreadyLinked'] = 'Невозможно связать категории, так как они уже связаны';
    this.dictionary['CategoryDoesNotBelongsToUser'] = 'Невозможно использовать указанную категорию, так как она не принадлежит пользователю';
    this.dictionary['UserAlreadyHasCategoryWithSpecifiedName'] = 'Категория с указанным названием уже существует';
    this.dictionary['CurrentUserHasNoPermissionToDeleteCategory'] = 'Недостаточно прав для удаления категории';
  }
  get(code: string): string {
    return this.dictionary[code];
  }
}
