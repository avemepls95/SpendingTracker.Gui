import {
  AccountListItemDto,
  AccountsSummaryDto,
  CategoryAnalyticsDto,
  CategoryAnalyticsItemDto,
  CategoryDto,
  CurrencyDto,
  MarkupDto,
  MarkupOperationResultDto,
  MarkupsPageDto,
  ScheduleSpendingDto,
  SpendingDto,
  SpendingsPageDto,
  SpendingScheduleDetailsDto,
  SpendingScheduleDto,
  TagAnalyticsDto,
  TagAnalyticsItemDto,
  TagDto,
} from '../dto/api.dto';
import {
  ACCOUNT_TYPES,
  AccountListItem,
  AccountType,
  AccountsSummary,
  Category,
  CategoryAnalytics,
  CategoryAnalyticsItem,
  Currency,
  INTERVAL_UNITS,
  IntervalUnit,
  MARKUP_VERDICTS,
  MarkupEntry,
  MarkupOperationResult,
  MarkupVerdict,
  MarkupsPage,
  RECURRENCE_KINDS,
  RecurrenceKind,
  SPENDING_CATEGORY_SOURCES,
  ScheduleSpending,
  Spending,
  SpendingCategorySource,
  SpendingSchedule,
  SpendingScheduleDetails,
  SpendingsPageResult,
  Tag,
  TagAnalytics,
  TagAnalyticsItem,
} from '../models/models';

export function toCurrency(dto: CurrencyDto): Currency {
  return {
    id: dto.id,
    code: dto.code,
    title: dto.title,
    flagEmojiCode: dto.flagEmojiCode,
  };
}

export function toTag(dto: TagDto): Tag {
  return {
    id: dto.id,
    title: dto.title,
    group: dto.group ?? null,
    // Умолчание «не переносить» повторяет серверное: цена ошибки несимметрична -
    // не перенесённый тег человек навесит руками и увидит, а перенесённый зря
    // молча исказит аналитику по тегам.
    spreadsByDescription: dto.spreadsByDescription === true,
  };
}

/**
 * Приводит категорию.
 *
 * Сервер настроен не сериализовать null, поэтому `parentId` у корневых
 * категорий в ответе просто отсутствует - это не признак ошибки.
 */
export function toCategory(dto: CategoryDto): Category {
  return {
    id: dto.id,
    title: dto.title,
    createDate: dto.createDate ?? null,
    parentId: dto.parentId ?? null,
    tags: (dto.tags ?? []).map(toTag),
  };
}

export function toSpending(dto: SpendingDto): Spending {
  return {
    id: dto.id,
    amount: dto.amount,
    currencyId: dto.currencyId,
    date: dto.date,
    createDate: dto.createDate,
    description: dto.description,
    category: dto.category ? toCategory(dto.category) : null,
    tags: (dto.tags ?? []).map(toTag),
    scheduleId: dto.scheduleId ?? null,
    categorySource: toCategorySource(dto.categorySource),
  };
}

/**
 * Приводит страницу трат.
 *
 * Пустое тело не должно ронять список: до смены контракта сервер отдавал
 * массив, и старый образ Web API под новым фронтом ответил бы именно так.
 */
export function toSpendingsPage(dto: SpendingsPageDto): SpendingsPageResult {
  return {
    items: (dto?.items ?? []).map(toSpending),
    withoutCategoryCount: dto?.withoutCategoryCount ?? 0,
  };
}

function toMarkupEntry(dto: MarkupDto): MarkupEntry {
  return {
    id: dto.id,
    normalizedDescription: dto.normalizedDescription,
    category: dto.category ? toCategory(dto.category) : null,
    tags: (dto.tags ?? []).map(toTag),
    verdict: toMarkupVerdict(dto.verdict),
  };
}

export function toMarkupsPage(dto: MarkupsPageDto): MarkupsPage {
  return {
    items: (dto?.items ?? []).map(toMarkupEntry),
    totalCount: dto?.totalCount ?? 0,
  };
}

/**
 * Приводит итог операции над словарной записью.
 *
 * wasApplied по умолчанию false: неразобранный ответ безопаснее показать как
 * «уже обработано», чем отрапортовать об изменении, которого не было.
 */
export function toMarkupOperationResult(
  dto: MarkupOperationResultDto,
): MarkupOperationResult {
  return {
    wasApplied: dto?.wasApplied === true,
    affectedSpendings: dto?.affectedSpendings ?? 0,
  };
}

/**
 * Сервер шлёт перечисления строками. Незнакомое значение приводится к null:
 * значок источника - подсказка, и неизвестный источник лучше не рисовать
 * вовсе, чем выдать чужую догадку за проверенную разметку.
 */
function toCategorySource(
  value: string | null | undefined,
): SpendingCategorySource | null {
  return SPENDING_CATEGORY_SOURCES.find((item) => item === value) ?? null;
}

/**
 * Незнакомый вердикт приводится к «решения нет»: это единственное состояние,
 * которое ничего не обещает пользователю - ни назначенной категории, ни
 * запрета на обращение к модели.
 */
function toMarkupVerdict(value: string | null | undefined): MarkupVerdict {
  return MARKUP_VERDICTS.find((item) => item === value) ?? 'None';
}

export function toSpendingSchedule(dto: SpendingScheduleDto): SpendingSchedule {
  return {
    id: dto.id,
    description: dto.description,
    amount: dto.amount,
    currencyId: dto.currencyId,
    category: dto.category ? toCategory(dto.category) : null,
    tags: (dto.tags ?? []).map(toTag),
    isActive: dto.isActive,
    recurrenceKind: toRecurrenceKind(dto.recurrenceKind),
    intervalUnit: toIntervalUnit(dto.intervalUnit),
    intervalValue: dto.intervalValue,
    startDate: dto.startDate,
    startTime: dto.startTime,
    endDate: dto.endDate ?? null,
    nextOccurrenceDate: dto.nextOccurrenceDate ?? null,
    lastOccurrenceDate: dto.lastOccurrenceDate ?? null,
  };
}

export function toSpendingScheduleDetails(
  dto: SpendingScheduleDetailsDto,
): SpendingScheduleDetails {
  return {
    ...toSpendingSchedule(dto),
    createdSpendingsCount: dto.createdSpendingsCount,
    createdSpendings: (dto.createdSpendings ?? []).map(toScheduleSpending),
  };
}

function toScheduleSpending(dto: ScheduleSpendingDto): ScheduleSpending {
  return {
    id: dto.id,
    date: dto.date,
    amount: dto.amount,
    currencyId: dto.currencyId,
  };
}

/**
 * Сервер шлёт перечисления строками, и у обоих есть значение None. Незнакомое
 * значение приводится к интервальному правилу: оно показывается как «периодичность
 * не задана», а не роняет список.
 */
function toRecurrenceKind(value: string): RecurrenceKind {
  return RECURRENCE_KINDS.find((item) => item === value) ?? 'Interval';
}

function toIntervalUnit(value: string | null | undefined): IntervalUnit | null {
  const unit = INTERVAL_UNITS.find((item) => item === value);

  return unit ?? null;
}

export function toAccountListItem(dto: AccountListItemDto): AccountListItem {
  return {
    id: dto.id,
    name: dto.name,
    type: toAccountType(dto.type),
    originalCurrencyId: dto.originalCurrencyId,
    originalCurrencyAmount: dto.originalCurrencyAmount,
    targetCurrencyAmount: dto.targetCurrencyAmount,
  };
}

export function toAccountsSummary(dto: AccountsSummaryDto): AccountsSummary {
  return {
    totalAmount: dto.totalAmount,
    accounts: (dto.accounts ?? []).map(toAccountListItem),
  };
}

/**
 * Приводит ответ аналитики по категориям.
 *
 * Список категорий сервер может прислать под одним из трёх имён - контракт
 * недоступен, а в прежнем коде ответ приводился к типу голым `as`, поэтому
 * расхождение имени поля выглядело как «детализации просто нет».
 */
export function toCategoryAnalytics(dto: CategoryAnalyticsDto): CategoryAnalytics {
  const roots = dto.categoryInfos ?? dto.categories ?? dto.childs ?? [];

  return {
    totalAmount: dto.totalAmount ?? 0,
    categories: roots.map(toCategoryAnalyticsItem),
  };
}

export function toTagAnalytics(dto: TagAnalyticsDto): TagAnalytics {
  return {
    totalAmount: dto.totalAmount ?? 0,
    untaggedAmount: dto.untaggedAmount ?? 0,
    tags: (dto.tagInfos ?? []).map(toTagAnalyticsItem),
  };
}

function toTagAnalyticsItem(dto: TagAnalyticsItemDto): TagAnalyticsItem {
  return {
    tagId: dto.tagId,
    tagTitle: dto.tagTitle,
    group: dto.group ?? null,
    amount: dto.amount ?? 0,
  };
}

function toCategoryAnalyticsItem(
  dto: CategoryAnalyticsItemDto,
): CategoryAnalyticsItem {
  const children = dto.children ?? dto.childs ?? [];

  return {
    categoryId: dto.categoryId,
    categoryTitle: dto.categoryTitle,
    amount: dto.amount ?? 0,
    children: children.map(toCategoryAnalyticsItem),
  };
}

/** Незнакомый тип счёта не должен ронять список: показываем как «Другое». */
function toAccountType(value: string): AccountType {
  return (ACCOUNT_TYPES as readonly string[]).includes(value)
    ? (value as AccountType)
    : 'Other';
}
