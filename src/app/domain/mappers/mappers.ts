import {
  AccountListItemDto,
  AccountsSummaryDto,
  CategoryAnalyticsDto,
  CategoryAnalyticsItemDto,
  CategoryDto,
  CurrencyDto,
  SpendingDto,
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
  Spending,
} from '../models/models';

export function toCurrency(dto: CurrencyDto): Currency {
  return {
    id: dto.id,
    code: dto.code,
    title: dto.title,
    flagEmojiCode: dto.flagEmojiCode,
  };
}

export function toCategory(dto: CategoryDto): Category {
  return {
    id: dto.id,
    title: dto.title,
    createDate: dto.createDate ?? null,
    parents: (dto.parents ?? []).map(toCategory),
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
    categories: (dto.categories ?? []).map(toCategory),
  };
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
 * Приводит ответ аналитики.
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
