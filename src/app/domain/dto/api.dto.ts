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
