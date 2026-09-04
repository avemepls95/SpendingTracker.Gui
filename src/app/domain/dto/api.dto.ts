/** Контракты ответов сервера. Приходят как есть, приводятся мапперами. */

export interface CurrencyDto {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly flagEmojiCode: string;
}

export interface TagDto {
  readonly id: string;
  readonly title: string;
  /** Место, Поездка, Характер. Может отсутствовать. */
  readonly group?: string | null;
  /** Переносится ли тег на новые траты с таким же описанием. */
  readonly spreadsByDescription?: boolean | null;
}

export interface CategoryDto {
  readonly id: string;
  readonly title: string;
  readonly createDate?: string | null;
  /** Родитель. Отсутствует у категорий в корне дерева. */
  readonly parentId?: string | null;
  readonly tags?: readonly TagDto[] | null;
}

export interface SpendingDto {
  readonly id: string;
  readonly amount: number;
  readonly currencyId: string;
  readonly date: string;
  readonly createDate: string;
  readonly description: string;
  /** Категория траты. Отсутствует у неразнесённых трат. */
  readonly category?: CategoryDto | null;
  /** Собственные теги траты, без унаследованных от категории. */
  readonly tags?: readonly TagDto[] | null;
  /**
   * Расписание, породившее трату. Отсутствует у трат, заведённых вручную,
   * и во всех ответах, кроме list-with-categories: остальные его не отдают.
   */
  readonly scheduleId?: string | null;
  /**
   * Кто проставил категорию. Отсутствует, когда категории нет, и в ответе
   * filtered-list: тот контракт категорию не несёт вовсе.
   */
  readonly categorySource?: string | null;
}

/**
 * Страница списка трат.
 *
 * Эндпоинт list-with-categories отдавал голый массив и сменил тело на объект:
 * счётчик очереди некуда было положить. Счётчик считается по всем тратам
 * владельца, а не по странице и не по строке поиска.
 */
export interface SpendingsPageDto {
  readonly items?: readonly SpendingDto[] | null;
  readonly withoutCategoryCount?: number | null;
}

/** Запись словаря разметки: нормализованное описание и что оно означает. */
export interface MarkupDto {
  readonly id: string;
  readonly normalizedDescription: string;
  /** Отсутствует у вердиктов, которые категорию не назначают. */
  readonly category?: CategoryDto | null;
  readonly tags?: readonly TagDto[] | null;
  readonly verdict: string;
}

export interface MarkupsPageDto {
  readonly items?: readonly MarkupDto[] | null;
  /** Число записей под тем же фильтром, а не на текущей странице. */
  readonly totalCount?: number | null;
}

/** Итог операции над словарной записью: применилась ли и сколько трат затронула. */
export interface MarkupOperationResultDto {
  readonly wasApplied?: boolean | null;
  readonly affectedSpendings?: number | null;
}

export interface SpendingScheduleDto {
  readonly id: string;
  readonly description: string;
  readonly amount: number;
  readonly currencyId: string;
  readonly category?: CategoryDto | null;
  readonly tags?: readonly TagDto[] | null;
  readonly isActive: boolean;
  readonly recurrenceKind: string;
  /** У однократных правил приходит как None. */
  readonly intervalUnit?: string | null;
  readonly intervalValue: number;
  readonly startDate: string;
  readonly startTime: string;
  readonly endDate?: string | null;
  readonly nextOccurrenceDate?: string | null;
  readonly lastOccurrenceDate?: string | null;
}

export interface ScheduleSpendingDto {
  readonly id: string;
  readonly date: string;
  readonly amount: number;
  readonly currencyId: string;
}

export interface SpendingScheduleDetailsDto extends SpendingScheduleDto {
  readonly createdSpendingsCount: number;
  readonly createdSpendings?: readonly ScheduleSpendingDto[] | null;
}

export interface PreviewOccurrencesDto {
  readonly occurrences?: readonly string[] | null;
}

export interface AccountListItemDto {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly originalCurrencyId: string;
  readonly originalCurrencyAmount: number;
  readonly targetCurrencyAmount: number;
}

export interface AccountsSummaryDto {
  readonly totalAmount: number;
  readonly accounts: readonly AccountListItemDto[] | null;
}

export interface UserSettingsDto {
  readonly viewCurrencyId: string | null;
  /** Разрешение отправлять описания трат в языковую модель. */
  readonly aiMarkupUserConsent?: boolean | null;
  /**
   * Месячный лимит обращений к модели. Только для чтения: его правит владелец
   * сервиса прямо в базе, отдельного механизма для этого в системе нет.
   */
  readonly aiMarkupMonthlyLimit?: number | null;
}

/**
 * Узел аналитики по категориям.
 *
 * Имя поля с детьми у сервера и клиента исторически расходилось: модель
 * объявляла `categoryInfos`, её же конструктор принимал `childs`. Оба варианта
 * объявлены необязательными, разбор в маппере принимает любой.
 */
export interface CategoryAnalyticsItemDto {
  readonly categoryId: string;
  readonly categoryTitle: string;
  readonly amount: number;
  readonly childs?: readonly CategoryAnalyticsItemDto[] | null;
  readonly children?: readonly CategoryAnalyticsItemDto[] | null;
}

export interface CategoryAnalyticsDto {
  readonly totalAmount: number;
  readonly categoryInfos?: readonly CategoryAnalyticsItemDto[] | null;
  readonly childs?: readonly CategoryAnalyticsItemDto[] | null;
  readonly categories?: readonly CategoryAnalyticsItemDto[] | null;
}

export interface TagAnalyticsItemDto {
  readonly tagId: string;
  readonly tagTitle: string;
  readonly group?: string | null;
  readonly amount: number;
}

export interface TagAnalyticsDto {
  readonly totalAmount: number;
  readonly untaggedAmount?: number | null;
  readonly tagInfos?: readonly TagAnalyticsItemDto[] | null;
}
