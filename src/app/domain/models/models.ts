/** Модели предметной области. */

export interface Currency {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly flagEmojiCode: string;
}

export interface Category {
  readonly id: string;
  readonly title: string;
  readonly createDate: string | null;
  /** Родительские категории. Дерево строится вверх: от траты к обобщению. */
  readonly parents: readonly Category[];
}

export interface Spending {
  readonly id: string;
  readonly amount: number;
  readonly currencyId: string;
  readonly date: string;
  readonly createDate: string;
  readonly description: string;
  readonly categories: readonly Category[];
}

export const ACCOUNT_TYPES = [
  'DebitCard',
  'CreditCard',
  'Cash',
  'Brokerage',
  'Other',
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export interface UserAccount {
  readonly id: string;
  readonly name: string;
  readonly type: AccountType;
  readonly currencyId: string;
  readonly amount: number;
}

export interface AccountListItem {
  readonly id: string;
  readonly name: string;
  readonly type: AccountType;
  readonly originalCurrencyId: string;
  readonly originalCurrencyAmount: number;
  readonly targetCurrencyAmount: number;
}

export interface AccountsSummary {
  readonly totalAmount: number;
  readonly accounts: readonly AccountListItem[];
}

export interface UserSettings {
  readonly viewCurrencyId: string;
}

export interface CategoryAnalyticsItem {
  readonly categoryId: string;
  readonly categoryTitle: string;
  readonly amount: number;
  readonly children: readonly CategoryAnalyticsItem[];
}

export interface CategoryAnalytics {
  readonly totalAmount: number;
  readonly categories: readonly CategoryAnalyticsItem[];
}

/** Подписи и признаки типов счетов. */
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  DebitCard: 'Дебетовая карта',
  CreditCard: 'Кредитная карта',
  Cash: 'Наличные',
  Brokerage: 'Брокерский счёт',
  Other: 'Другое',
};
