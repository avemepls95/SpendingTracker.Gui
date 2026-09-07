import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AiCallSiteDto,
  AiConnectionCheckResultDto,
  AiSettingsDto,
  AiUsageKindDto,
  AiUsageLogPageDto,
  AiUsagePeriodDto,
  AiUsageSummaryDto,
  UpdateAiSettingsDto,
} from '../dto/ai-usage.dto';

export interface AiUsageLogQuery {
  readonly period: AiUsagePeriodDto;
  readonly callSite: AiCallSiteDto | null;
  readonly kind: AiUsageKindDto | null;
  readonly userId: string | null;

  /** Курсор предыдущей страницы; null - первая. */
  readonly cursor: string | null;

  readonly count: number;
}

/**
 * Админский раздел расхода на ИИ.
 *
 * Обычный пользователь получает от этих маршрутов 404 - тот же ответ, что от
 * несуществующих. Признак администратора спрашивает UserApiService: его маршрут
 * отвечает всем, иначе признак было бы некому спросить.
 */
@Injectable({ providedIn: 'root' })
export class AiUsageApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.spendingApi}v1/admin/ai-usage`;

  getSummary(period: AiUsagePeriodDto): Observable<AiUsageSummaryDto> {
    const params = new HttpParams().set('period', period);

    return this.http.get<AiUsageSummaryDto>(`${this.baseUrl}/summary`, { params });
  }

  getLog(query: AiUsageLogQuery): Observable<AiUsageLogPageDto> {
    let params = new HttpParams()
      .set('period', query.period)
      .set('count', query.count);

    if (query.callSite) {
      params = params.set('callSite', query.callSite);
    }

    if (query.kind) {
      params = params.set('kind', query.kind);
    }

    if (query.userId) {
      params = params.set('userId', query.userId);
    }

    if (query.cursor) {
      params = params.set('cursor', query.cursor);
    }

    return this.http.get<AiUsageLogPageDto>(`${this.baseUrl}/log`, { params });
  }

  getSettings(): Observable<AiSettingsDto> {
    return this.http.get<AiSettingsDto>(`${this.baseUrl}/settings`);
  }

  updateSettings(settings: UpdateAiSettingsDto): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/settings`, settings);
  }

  /**
   * Проверка связи по сохранённым настройкам места вызова.
   *
   * POST, а не GET: обращение стоит денег и пишет строку журнала. Настройки телом не идут -
   * сервер читает их из базы, иначе проверить можно было бы одно, а сохранить другое.
   */
  checkConnection(callSite: AiCallSiteDto): Observable<AiConnectionCheckResultDto> {
    return this.http.post<AiConnectionCheckResultDto>(`${this.baseUrl}/check-connection`, {
      callSite,
    });
  }
}
