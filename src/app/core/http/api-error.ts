/** Элемент тела ответа 400, как его отдаёт сервер. */
export interface ApiErrorItem {
  readonly code: string;
  readonly message: string;
  readonly messageIsCustom: boolean;
  readonly data: unknown;
}

const GENERIC_MESSAGE = 'Произошла непредвиденная ошибка';

/**
 * Текст ошибки по коду.
 *
 * Возвращает null для незнакомого кода. Прежняя реализация бросала здесь
 * исключение, из-за чего оно улетало наружу из интерцептора и пользователь
 * не видел вообще никакого сообщения.
 */
export function describeErrorCode(code: string, data: unknown): string | null {
  switch (code) {
    case 'RecursivelyAddedCategory':
      return 'Категории уже связаны в обратную сторону';
    case 'CategoriesAlreadyLinked':
      return 'Категории уже связаны';
    case 'CategoryDoesNotBelongsToUser':
      return 'Категория принадлежит другому пользователю';
    case 'UserAlreadyHasCategoryWithSpecifiedName':
      return 'Категория с таким названием уже есть';
    case 'CurrentUserHasNoPermissionToDeleteCategory':
      return 'Недостаточно прав, чтобы удалить категорию';
    case 'TooManyAccountsCount': {
      const maxCount = Number(data);
      return Number.isFinite(maxCount) && maxCount > 0
        ? `Больше ${maxCount} счетов создать нельзя`
        : 'Достигнут предел количества счетов';
    }
    case 'CannotCreateAccountBecauseAlreadyExist':
      return 'Такой счёт уже есть';
    case 'SpendingScheduleDoesNotBelongsToUser':
      return 'Расписание принадлежит другому пользователю';
    case 'InvalidRecurrenceRule':
      return 'По такому правилу не будет ни одного срабатывания';
    // Сервер умел отдавать этот код и раньше - фронтенд его просто не знал.
    case 'TagDoesNotBelongsToUser':
      return 'Тег принадлежит другому пользователю';
    case 'KeyNotFound':
      return 'Запись не найдена: возможно, её уже удалили';
    default:
      return null;
  }
}

/**
 * Разбирает тело ответа 400 в список сообщений для пользователя.
 *
 * Проверяет, что пришёл массив: при другой форме тела прежний код молча
 * ничего не показывал, и ошибка выглядела как зависание.
 */
export function extractErrorMessages(body: unknown): string[] {
  if (!Array.isArray(body)) {
    return [GENERIC_MESSAGE];
  }

  const messages = body
    .filter((item): item is ApiErrorItem => isErrorItem(item))
    .map((item) =>
      item.messageIsCustom && item.message
        ? item.message
        : (describeErrorCode(item.code, item.data) ?? GENERIC_MESSAGE),
    );

  return messages.length > 0 ? messages : [GENERIC_MESSAGE];
}

function isErrorItem(value: unknown): value is ApiErrorItem {
  return typeof value === 'object' && value !== null && 'code' in value;
}
