/** Модели предметной области. */

export interface Currency {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly flagEmojiCode: string;
}

/** Второе измерение разметки: место, поездка, характер расхода. */
export interface Tag {
  readonly id: string;
  readonly title: string;
  readonly group: string | null;
}

export interface Category {
  readonly id: string;
  readonly title: string;
  readonly createDate: string | null;
  /** Категория, в которую вложена текущая. null - категория в корне дерева. */
  readonly parentId: string | null;
  /** Теги самой категории: действуют на все её траты и на траты вложенных категорий. */
  readonly tags: readonly Tag[];
}

export interface Spending {
  readonly id: string;
  readonly amount: number;
  readonly currencyId: string;
  readonly date: string;
  readonly createDate: string;
  readonly description: string;
  /** Категория траты. null - трата не разнесена. */
  readonly category: Category | null;
  /** Собственные теги траты, без унаследованных от категории. */
  readonly tags: readonly Tag[];
  /** Расписание, создавшее трату. null - трата заведена вручную. */
  readonly scheduleId: string | null;
}

export const RECURRENCE_KINDS = ['Once', 'Interval'] as const;
export type RecurrenceKind = (typeof RECURRENCE_KINDS)[number];

export const INTERVAL_UNITS = ['Hour', 'Day', 'Week', 'Month', 'Year'] as const;
export type IntervalUnit = (typeof INTERVAL_UNITS)[number];

/** Правило повторения без прикладных полей: то, что принимает предпросмотр. */
export interface RecurrenceInput {
  readonly recurrenceKind: RecurrenceKind;
  readonly intervalUnit: IntervalUnit | null;
  readonly intervalValue: number;
  /** Локальная дата якоря, dd.MM.yyyy. */
  readonly startDate: string;
  /** Локальное время, HH:mm. */
  readonly startTime: string;
  readonly endDate: string | null;
}

export interface SpendingScheduleInput extends RecurrenceInput {
  readonly description: string;
  readonly amount: number;
  readonly currencyId: string;
  readonly categoryId: string | null;
  readonly tagIds: readonly string[];
}

export interface SpendingSchedule extends RecurrenceInput {
  readonly id: string;
  readonly description: string;
  readonly amount: number;
  readonly currencyId: string;
  readonly category: Category | null;
  readonly tags: readonly Tag[];
  readonly isActive: boolean;
  /** Локальная строка dd.MM.yyyy HH:mm. null - будущих срабатываний нет. */
  readonly nextOccurrenceDate: string | null;
  readonly lastOccurrenceDate: string | null;
}

/** Трата, созданная расписанием. */
export interface ScheduleSpending {
  readonly id: string;
  readonly date: string;
  readonly amount: number;
  readonly currencyId: string;
}

export interface SpendingScheduleDetails extends SpendingSchedule {
  readonly createdSpendingsCount: number;
  readonly createdSpendings: readonly ScheduleSpending[];
}

/** Расписание отработало своё: правило исчерпано, но его никто не останавливал. */
export function isScheduleFinished(schedule: SpendingSchedule): boolean {
  return schedule.isActive && schedule.nextOccurrenceDate === null;
}

export const INTERVAL_UNIT_LABELS: Record<IntervalUnit, string> = {
  Hour: 'час',
  Day: 'день',
  Week: 'неделя',
  Month: 'месяц',
  Year: 'год',
};

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

export interface TagAnalyticsItem {
  readonly tagId: string;
  readonly tagTitle: string;
  readonly group: string | null;
  readonly amount: number;
}

export interface TagAnalytics {
  readonly totalAmount: number;
  /** Траты без единого тега - ни своего, ни унаследованного от категории. */
  readonly untaggedAmount: number;
  readonly tags: readonly TagAnalyticsItem[];
}

/** Подписи и признаки типов счетов. */
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  DebitCard: 'Дебетовая карта',
  CreditCard: 'Кредитная карта',
  Cash: 'Наличные',
  Brokerage: 'Брокерский счёт',
  Other: 'Другое',
};

/** Группа для тегов, у которых она не задана. */
export const UNGROUPED_TAG_LABEL = 'Без группы';
