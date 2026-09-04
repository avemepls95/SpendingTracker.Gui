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

/**
 * Откуда у траты категория.
 *
 * Manual - решение человека на самой трате, в том числе категория из
 * расписания; History - применена запись словаря, назначенная человеком;
 * Model - применена догадка модели, которую человек ещё не смотрел.
 */
export const SPENDING_CATEGORY_SOURCES = ['Manual', 'History', 'Model'] as const;
export type SpendingCategorySource = (typeof SPENDING_CATEGORY_SOURCES)[number];

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
  /**
   * Кто проставил категорию. null - категории нет либо ответ её не несёт:
   * filtered-list такого поля не отдаёт вовсе.
   */
  readonly categorySource: SpendingCategorySource | null;
}

/**
 * Страница списка трат вместе с размером очереди неразнесённых.
 *
 * Не `SpendingsPage`: так называется компонент экрана трат, и в сигнатуре
 * запроса это имя читалось бы как страница интерфейса.
 */
export interface SpendingsPageResult {
  readonly items: readonly Spending[];
  /** Всего трат владельца без категории - независимо от фильтров страницы. */
  readonly withoutCategoryCount: number;
}

/**
 * Состояние словарной записи по категории.
 *
 * Вердикт описывает только категорию: теги всегда человеческие, модель их не
 * предлагает и не трогает, поэтому запись с вердиктом None вполне может нести
 * теги - это нормальное состояние, а не полупустая запись.
 */
export const MARKUP_VERDICTS = [
  'None',
  'AssignedByUser',
  'AssignedByModel',
  'RejectedByUser',
  'ModelFailed',
] as const;

export type MarkupVerdict = (typeof MARKUP_VERDICTS)[number];

/** Запись словаря: что означает нормализованное описание. */
export interface MarkupEntry {
  readonly id: string;
  readonly normalizedDescription: string;
  /** null - вердикт категории не назначает либо её сняли. */
  readonly category: Category | null;
  readonly tags: readonly Tag[];
  readonly verdict: MarkupVerdict;
}

export interface MarkupsPage {
  readonly items: readonly MarkupEntry[];
  /** Число записей под тем же фильтром, а не на текущей странице. */
  readonly totalCount: number;
}

/**
 * Итог операции над словарной записью.
 *
 * wasApplied = false означает «уже обработано», а не ошибку: запись уже
 * подтверждена, уже отвергнута или удалена. Типично при повторном нажатии и
 * при работе из двух вкладок.
 */
export interface MarkupOperationResult {
  readonly wasApplied: boolean;
  readonly affectedSpendings: number;
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
  /** ISO-строка, как у Spending.date, а не локальная строка расписания. */
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
  /** Разрешение отправлять описания трат в языковую модель. */
  readonly aiMarkupUserConsent: boolean;
  /**
   * Месячный лимит обращений к модели. Только для чтения: его правит владелец
   * сервиса. При нулевом лимите включённое согласие ничего не даёт.
   */
  readonly aiMarkupMonthlyLimit: number;
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

/**
 * Подписи вердиктов.
 *
 * Названы состоянием описания, а не внутренним термином: «решения нет» вместо
 * None. Человеку важно, спросят ли про это описание модель и почему.
 */
export const MARKUP_VERDICT_LABELS: Record<MarkupVerdict, string> = {
  None: 'Решения нет',
  AssignedByUser: 'Назначено вами',
  AssignedByModel: 'Догадка модели',
  RejectedByUser: 'Отвергнуто вами',
  ModelFailed: 'Модель не смогла',
};

/** Чем каждый вердикт оборачивается для новых трат с этим описанием. */
export const MARKUP_VERDICT_HINTS: Record<MarkupVerdict, string> = {
  None: 'Категории у описания нет, и оно уйдёт в модель.',
  AssignedByUser: 'Новые траты с этим описанием получат категорию сразу.',
  AssignedByModel: 'Категорию предложила модель - проверьте её.',
  RejectedByUser: 'Модель об этом описании больше не спрашивают.',
  ModelFailed: 'Модель не смогла подобрать категорию.',
};
