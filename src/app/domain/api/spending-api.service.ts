import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { formatApiDate } from '../../shared/util/date.util';
import {
  AccountsSummaryDto,
  CategoryAnalyticsDto,
  CategoryDto,
  CurrencyDto,
  SpendingDto,
  TagAnalyticsDto,
  TagDto,
  UserSettingsDto,
} from '../dto/api.dto';
import {
  toAccountsSummary,
  toCategory,
  toCategoryAnalytics,
  toCurrency,
  toSpending,
  toTag,
  toTagAnalytics,
} from '../mappers/mappers';
import {
  AccountType,
  AccountsSummary,
  Category,
  CategoryAnalytics,
  Currency,
  Spending,
  Tag,
  TagAnalytics,
  UserAccount,
  UserSettings,
} from '../models/models';

export interface SpendingsQuery {
  readonly offset: number;
  readonly count: number;
  readonly searchString: string;
  readonly onlyWithoutCategories: boolean;
}

export interface FilteredSpendingsQuery {
  readonly targetCurrencyId: string;
  readonly categoryId: string;
  readonly dateFrom: Date;
  readonly dateTo: Date;
}

/**
 * Обращения к API трекера.
 *
 * Сервис только ходит в сеть и приводит ответы к моделям. Проверок входных
 * данных с выбрасыванием исключений здесь нет: прежняя версия бросала их
 * синхронно из методов, возвращающих Observable, поэтому ошибка летела мимо
 * обработчиков подписки.
 */
@Injectable({ providedIn: 'root' })
export class SpendingApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.spendingApi;

  // ------------------------------------------------------------ траты

  getSpendings(query: SpendingsQuery): Observable<readonly Spending[]> {
    const params = new HttpParams()
      .set('offset', query.offset)
      .set('count', query.count)
      .set('searchString', query.searchString)
      .set('onlyWithoutCategories', query.onlyWithoutCategories);

    return this.http
      .get<readonly SpendingDto[]>(this.url('v1/spending/list-with-categories'), { params })
      .pipe(map((items) => (items ?? []).map(toSpending)));
  }

  /**
   * Трата по идентификатору.
   *
   * scheduleId в этом ответе сервер не отдаёт, поэтому он всегда null:
   * класть результат в список трат нельзя - пометка «по расписанию» пропадёт.
   */
  getSpendingById(id: string): Observable<Spending> {
    const params = new HttpParams().set('id', id);

    return this.http
      .get<SpendingDto>(this.url('v1/spending/get-by-id'), { params })
      .pipe(map(toSpending));
  }

  getFilteredSpendings(query: FilteredSpendingsQuery): Observable<readonly Spending[]> {
    const params = new HttpParams()
      .set('targetCurrencyId', query.targetCurrencyId)
      .set('categoryId', query.categoryId)
      .set('dateFrom', formatApiDate(query.dateFrom))
      .set('dateTo', formatApiDate(query.dateTo));

    return this.http
      .get<readonly SpendingDto[]>(this.url('v1/spending/filtered-list'), { params })
      .pipe(map((items) => (items ?? []).map(toSpending)));
  }

  updateSpending(spending: {
    id: string;
    amount: number;
    currencyId: string;
    date: Date;
    description: string;
  }): Observable<unknown> {
    return this.http.post(this.url('v1/spending/update'), {
      id: spending.id,
      amount: spending.amount,
      currencyId: spending.currencyId,
      date: formatApiDate(spending.date),
      description: spending.description,
    });
  }

  deleteSpending(id: string): Observable<unknown> {
    return this.http.post(this.url('v1/spending/delete'), { id });
  }

  // ------------------------------------------------------------ категории

  getCategories(): Observable<readonly Category[]> {
    return this.http
      .get<readonly CategoryDto[]>(this.url('v1/category/list'))
      .pipe(map((items) => (items ?? []).map(toCategory)));
  }

  createCategory(title: string, parentId: string | null = null): Observable<unknown> {
    return this.http.post(this.url('v1/category/create'), { title, parentId });
  }

  updateCategory(category: { id: string; title: string }): Observable<unknown> {
    return this.http.post(this.url('v1/category/update'), {
      id: category.id,
      title: category.title,
    });
  }

  deleteCategory(id: string): Observable<unknown> {
    return this.http.post(this.url('v1/category/delete'), { id });
  }

  /** Переносит категорию к другому родителю. null - в корень дерева. */
  moveCategory(categoryId: string, newParentId: string | null): Observable<unknown> {
    return this.http.post(this.url('v1/category/move'), { categoryId, newParentId });
  }

  // ------------------------------------------------------------ теги

  getTags(): Observable<readonly Tag[]> {
    return this.http
      .get<readonly TagDto[]>(this.url('v1/tag/list'))
      .pipe(map((items) => (items ?? []).map(toTag)));
  }

  createTag(title: string, group: string | null = null): Observable<unknown> {
    return this.http.post(this.url('v1/tag/create'), { title, group });
  }

  updateTag(tag: { id: string; title: string; group: string | null }): Observable<unknown> {
    return this.http.post(this.url('v1/tag/update'), tag);
  }

  deleteTag(id: string): Observable<unknown> {
    return this.http.post(this.url('v1/tag/delete'), { id });
  }

  setCategoryTag(categoryId: string, tagId: string, isSet: boolean): Observable<unknown> {
    return this.http.post(this.url('v1/tag/set-for-category'), {
      categoryId,
      tagId,
      isSet,
    });
  }

  setSpendingTag(spendingId: string, tagId: string, isSet: boolean): Observable<unknown> {
    return this.http.post(this.url('v1/tag/set-for-spending'), {
      spendingId,
      tagId,
      isSet,
    });
  }

  // ------------------------------------- связь траты и категории

  /** Проставляет трате категорию. null - снимает разметку. */
  setSpendingCategory(spendingId: string, categoryId: string | null): Observable<unknown> {
    return this.http.post(this.url('v1/spending/set-category'), {
      spendingId,
      categoryId,
    });
  }

  linkSpendingToNewCategory(
    spendingId: string,
    newCategoryTitle: string,
    parentId: string | null = null,
  ): Observable<unknown> {
    return this.http.post(this.url('v1/spending/add-to-new-category'), {
      spendingId,
      newCategoryTitle,
      parentId,
    });
  }

  // ------------------------------------------------------------ счета

  getAccounts(currencyId: string): Observable<AccountsSummary> {
    const params = new HttpParams().set('currencyId', currencyId);

    return this.http
      .get<AccountsSummaryDto>(this.url('v1/account/get-list-info'), { params })
      .pipe(map(toAccountsSummary));
  }

  createAccount(account: {
    name: string;
    type: AccountType;
    currencyId: string;
    amount: number;
  }): Observable<unknown> {
    return this.http.post(this.url('v1/account/create'), account);
  }

  updateAccount(account: UserAccount): Observable<unknown> {
    return this.http.post(this.url('v1/account/update'), {
      id: account.id,
      name: account.name,
      type: account.type,
      currencyId: account.currencyId,
      amount: account.amount,
    });
  }

  deleteAccount(id: string): Observable<unknown> {
    return this.http.post(this.url('v1/account/delete'), { id });
  }

  // ------------------------------------------------------------ справочники

  getCurrencies(): Observable<readonly Currency[]> {
    return this.http
      .get<readonly CurrencyDto[]>(this.url('v1/currency/list'))
      .pipe(map((items) => (items ?? []).map(toCurrency)));
  }

  getUserSettings(): Observable<UserSettings> {
    return this.http
      .get<UserSettingsDto>(this.url('v1/user-settings/list'))
      .pipe(map((dto) => ({ viewCurrencyId: dto?.viewCurrencyId ?? '' })));
  }

  updateUserSettings(settings: UserSettings): Observable<unknown> {
    return this.http.post(this.url('v1/user-settings/update'), {
      ViewCurrencyId: settings.viewCurrencyId,
    });
  }

  // ------------------------------------------------------------ аналитика

  getCategoriesAnalytics(
    dateFrom: Date,
    dateTo: Date,
    targetCurrencyId: string,
    tagIds: readonly string[] = [],
  ): Observable<CategoryAnalytics> {
    return this.http
      .get<CategoryAnalyticsDto>(this.url('v1/analytics/by-date-range'), {
        params: this.analyticsParams(dateFrom, dateTo, targetCurrencyId, tagIds),
      })
      .pipe(map(toCategoryAnalytics));
  }

  getTagsAnalytics(
    dateFrom: Date,
    dateTo: Date,
    targetCurrencyId: string,
    tagIds: readonly string[] = [],
  ): Observable<TagAnalytics> {
    return this.http
      .get<TagAnalyticsDto>(this.url('v1/analytics/tags-by-date-range'), {
        params: this.analyticsParams(dateFrom, dateTo, targetCurrencyId, tagIds),
      })
      .pipe(map(toTagAnalytics));
  }

  /** Теги передаются повторяющимся параметром: так их принимает привязка модели. */
  private analyticsParams(
    dateFrom: Date,
    dateTo: Date,
    targetCurrencyId: string,
    tagIds: readonly string[],
  ): HttpParams {
    let params = new HttpParams()
      .set('dateFrom', formatApiDate(dateFrom))
      .set('dateTo', formatApiDate(dateTo))
      .set('targetCurrencyId', targetCurrencyId);

    for (const tagId of tagIds) {
      params = params.append('tagIds', tagId);
    }

    return params;
  }

  private url(path: string): string {
    return this.baseUrl + path;
  }
}
