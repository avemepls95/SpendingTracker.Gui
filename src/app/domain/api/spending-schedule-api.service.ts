import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  PreviewOccurrencesDto,
  SpendingScheduleDetailsDto,
  SpendingScheduleDto,
} from '../dto/api.dto';
import { toSpendingSchedule, toSpendingScheduleDetails } from '../mappers/mappers';
import {
  RecurrenceInput,
  SpendingSchedule,
  SpendingScheduleDetails,
  SpendingScheduleInput,
} from '../models/models';

/**
 * Обращения к API расписаний.
 *
 * Отдельно от spending-api.service: тот уже обслуживает траты, счета,
 * категории, теги, аналитику и настройки сразу.
 */
@Injectable({ providedIn: 'root' })
export class SpendingScheduleApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.spendingApi}v1/spending-schedule`;

  getSchedules(): Observable<readonly SpendingSchedule[]> {
    return this.http
      .get<readonly SpendingScheduleDto[] | null>(`${this.baseUrl}/list`)
      .pipe(map((items) => (items ?? []).map(toSpendingSchedule)));
  }

  getSchedule(id: string): Observable<SpendingScheduleDetails> {
    const params = new HttpParams().set('id', id);

    return this.http
      .get<SpendingScheduleDetailsDto>(`${this.baseUrl}/get-by-id`, { params })
      .pipe(map(toSpendingScheduleDetails));
  }

  createSchedule(input: SpendingScheduleInput): Observable<string> {
    return this.http.post<string>(`${this.baseUrl}/create`, toRequest(input));
  }

  updateSchedule(id: string, input: SpendingScheduleInput): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/update`, { id, ...toRequest(input) });
  }

  deleteSchedule(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/delete`, { id });
  }

  setActive(id: string, isActive: boolean): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/set-active`, { id, isActive });
  }

  runNow(id: string): Observable<SpendingScheduleDetails> {
    return this.http
      .post<SpendingScheduleDetailsDto>(`${this.baseUrl}/run-now`, { id })
      .pipe(map(toSpendingScheduleDetails));
  }

  previewOccurrences(rule: RecurrenceInput): Observable<readonly string[]> {
    return this.http
      .post<PreviewOccurrencesDto>(`${this.baseUrl}/preview-occurrences`, toRule(rule))
      .pipe(map((response) => response.occurrences ?? []));
  }
}

function toRequest(input: SpendingScheduleInput): Record<string, unknown> {
  return {
    description: input.description,
    amount: input.amount,
    currencyId: input.currencyId,
    categoryId: input.categoryId,
    tagIds: input.tagIds,
    ...toRule(input),
  };
}

function toRule(rule: RecurrenceInput): Record<string, unknown> {
  return {
    recurrenceKind: rule.recurrenceKind,
    intervalUnit: rule.intervalUnit,
    intervalValue: rule.intervalValue,
    startDate: rule.startDate,
    startTime: rule.startTime,
    endDate: rule.endDate,
  };
}
