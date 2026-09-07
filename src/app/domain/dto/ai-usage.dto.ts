/** Закрытый список периодов; сервер другое значение не принимает. */
export type AiUsagePeriodDto = 'Today' | 'Last7Days' | 'Last30Days' | 'CurrentMonth';

export type AiCallSiteDto = 'AutoMarkup';

/**
 * Вендор. Не литеральный тип: перечень поддерживаемых приходит с сервера, потому что
 * реализация вендора - свойство сборки, а не фронта.
 */
export type AiVendorDto = string;

/** Глубина размышления модели. Отсутствие значения - «не отправлять». */
export type AiEffortDto = 'Low' | 'Medium' | 'High' | 'XHigh' | 'Max';

/** Разметка или проверка связи. */
export type AiUsageKindDto = 'Markup' | 'ConnectionCheck';

/**
 * Итог проверки связи. Первые семь значений - ответ вендора, последние два означают, что
 * обращения не было вовсе.
 */
export type AiConnectionCheckStatusDto =
  | 'Ok'
  | 'KeyRejected'
  | 'ModelRejected'
  | 'RequestRejected'
  | 'RateLimited'
  | 'VendorUnavailable'
  | 'NoResponse'
  | 'NotConfigured'
  | 'Throttled';

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

  /** Разметка или проверка связи. */
  readonly kind: AiUsageKindDto;

  readonly callSite: AiCallSiteDto;
  readonly vendor: AiVendorDto;
  readonly model: string;

  /** Объём операции - сколько описаний ушло в этом обращении. У проверки связи ноль. */
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

  /** Отсутствует, если параметр решено не отправлять: его принимают не все модели. */
  readonly effort?: AiEffortDto;

  /** Отсутствует, если цену не вводили: до этого обращения к вендору не уходят. */
  readonly inputPricePerMillionTokens?: number;

  readonly outputPricePerMillionTokens?: number;
}

export interface AiSettingsDto {
  readonly callSites: readonly AiCallSiteSettingDto[];

  /** Вендоры, для которых в решении есть реализация. Выбирать можно только из них. */
  readonly supportedVendors: readonly AiVendorDto[];
  readonly retentionDays: number;
  readonly minRetentionDays: number;
  readonly minPricePerMillionTokens: number;
  readonly maxPricePerMillionTokens: number;
}

export interface UpdateAiSettingsDto {
  readonly callSite: AiCallSiteDto;
  readonly vendor: AiVendorDto;
  readonly model: string;
  readonly effort: AiEffortDto | null;
  readonly inputPricePerMillionTokens: number | null;
  readonly outputPricePerMillionTokens: number | null;
  readonly retentionDays: number;
}

/**
 * Итог проверки связи.
 *
 * Испытанные вендор, модель и глубина приходят обратно потому, что проверка читает их из базы,
 * а на экране может лежать несохранённая правка.
 */
export interface AiConnectionCheckResultDto {
  readonly status: AiConnectionCheckStatusDto;

  /** Что делать человеку: причина отказа до отправки либо предупреждение о журнале. */
  readonly message?: string;

  /**
   * Дословный текст ответа вендора. Он и различает «модель не принимает параметр» и «такой
   * модели нет»: ярлык статуса - только подсказка.
   */
  readonly vendorMessage?: string;

  /** Отсутствует, если строки настроек нет вовсе: испытывать было нечего. */
  readonly vendor?: AiVendorDto;

  readonly model: string;
  readonly effort?: AiEffortDto;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cost?: number;
  readonly elapsedMilliseconds: number;
}
