/** Закрытый список периодов; сервер другое значение не принимает. */
export type AiUsagePeriodDto = 'Today' | 'Last7Days' | 'Last30Days' | 'CurrentMonth';

export type AiCallSiteDto = 'AutoMarkup';

export type AiVendorDto = 'Anthropic';

export type AiUsageOutcomeDto = 'Sent' | 'Unparseable' | 'NoResponse' | 'NotSent';

export interface AiUsageCallSiteItemDto {
  readonly callSite: AiCallSiteDto;
  readonly requestCount: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cost: number;

  /** Сколько обращений пришлись на неизвестную стоимость и в сумму не вошли. */
  readonly unknownCostCount: number;
}

export interface AiUsageDayItemDto {
  readonly date: string;
  readonly requestCount: number;
  readonly cost: number;
  readonly unknownCostCount: number;
}

export interface AiUsageSummaryDto {
  readonly periodCost: number;
  readonly periodRequestCount: number;

  /**
   * Сколько обращений периода пришлись на неизвестную стоимость. Без этого числа сумма
   * читалась бы как полная, хотя часть расхода в неё не вошла.
   */
  readonly periodUnknownCostCount: number;

  readonly todayCost: number;
  readonly todayRequestCount: number;
  readonly todayUnknownCostCount: number;
  readonly byCallSite: readonly AiUsageCallSiteItemDto[];
  readonly byDay: readonly AiUsageDayItemDto[];
}

export interface AiUsageLogItemDto {
  readonly id: string;
  readonly requestDate: string;
  readonly userId: string;
  readonly callSite: AiCallSiteDto;
  readonly vendor: AiVendorDto;
  readonly model: string;

  /** Объём операции - сколько описаний ушло в этом обращении. */
  readonly descriptionsCount: number;

  readonly inputTokens: number;
  readonly outputTokens: number;

  /** Отсутствует, если стоимость не считалась: строка записана до появления тарифов. */
  readonly cost?: number;

  readonly outcome: AiUsageOutcomeDto;
}

export interface AiUsageLogPageDto {
  readonly items: readonly AiUsageLogItemDto[];

  /** Отсутствует на последней странице. */
  readonly nextCursor?: string;
}

export interface AiCallSiteSettingDto {
  readonly callSite: AiCallSiteDto;
  readonly vendor: AiVendorDto;
  readonly model: string;

  /** Отсутствует, если цену не вводили: до этого обращения к вендору не уходят. */
  readonly inputPricePerMillionTokens?: number;

  readonly outputPricePerMillionTokens?: number;
}

export interface AiSettingsDto {
  readonly callSites: readonly AiCallSiteSettingDto[];
  readonly retentionDays: number;
  readonly minRetentionDays: number;
  readonly minPricePerMillionTokens: number;
  readonly maxPricePerMillionTokens: number;
}

export interface UpdateAiSettingsDto {
  readonly callSite: AiCallSiteDto;
  readonly vendor: AiVendorDto;
  readonly model: string;
  readonly inputPricePerMillionTokens: number | null;
  readonly outputPricePerMillionTokens: number | null;
  readonly retentionDays: number;
}
