
export class ErrorCodeMessages {
  private static _instance: ErrorCodeMessages;

  public static get Instance()
  {
    return this._instance || (this._instance = new this());
  }

  get(code: string, data: any): string {
    switch(code) {
      case 'RecursivelyAddedCategory': {
        return 'Невозможно связать категории, так как они уже связаны в обратную сторону'
      }
      case 'CategoriesAlreadyLinked': {
        return 'Невозможно связать категории, так как они уже связаны';
      }
      case 'CategoryDoesNotBelongsToUser': {
        return 'Невозможно использовать указанную категорию, так как она не принадлежит пользователю';
      }
      case 'UserAlreadyHasCategoryWithSpecifiedName': {
        return 'Категория с указанным названием уже существует';
      }
      case 'CurrentUserHasNoPermissionToDeleteCategory': {
        return 'Недостаточно прав для удаления категории';
      }
      case 'TooManyAccountsCount': {
        let maxCount = Number(data);
        if (!maxCount) {
          throw Error('TooManyAccountsCount error processing. Invalid data from backend');
        }

        return `Максимально допустимое количество счетов - ${maxCount}`;
      }
      case 'CannotCreateAccountBecauseAlreadyExist': {
        return 'Счет с указанными параметрами уже существует';
      }
      default: {
        throw Error('Unexpected error code: ' + code);
      }
    }
  }
}
