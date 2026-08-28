/** Контракты ответов сервера. Приходят как есть, приводятся мапперами. */

export interface CurrencyDto {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly flagEmojiCode: string;
}

export interface CategoryDto {
  readonly id: string;
  readonly title: string;
  readonly createDate: string | null;
  readonly parents: readonly CategoryDto[] | null;
}

export interface SpendingDto {
  readonly id: string;
  readonly amount: number;
  readonly currencyId: string;
  readonly date: string;
  readonly createDate: string;
  readonly description: string;
  readonly categories: readonly CategoryDto[] | null;
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
 * Узел аналитики.
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
