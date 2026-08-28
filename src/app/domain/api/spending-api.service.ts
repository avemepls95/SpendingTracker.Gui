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
  UserSettingsDto,
} from '../dto/api.dto';
import {
  toAccountsSummary,
  toCategory,
  toCategoryAnalytics,
  toCurrency,
  toSpending,
} from '../mappers/mappers';
import {
  AccountType,
  AccountsSummary,
  Category,
  CategoryAnalytics,
  Currency,
  Spending,
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

  createCategory(title: string): Observable<unknown> {
    return this.http.post(this.url('v1/category/create'), { title });
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

  // ------------------------------------- связи траты и категорий

  linkSpendingToCategory(spendingId: string, categoryId: string): Observable<unknown> {
    return this.http.post(this.url('v1/spending/add-to-exist-category'), {
      spendingId,
      categoryId,
    });
  }

  linkSpendingToNewCategory(
    spendingId: string,
    newCategoryTitle: string,
  ): Observable<unknown> {
    return this.http.post(this.url('v1/spending/add-to-new-category'), {
      spendingId,
      newCategoryTitle,
    });
  }

  unlinkSpendingFromCategory(
    spendingId: string,
    categoryId: string,
  ): Observable<unknown> {
    return this.http.post(this.url('v1/spending/remove-from-category'), {
      spendingId,
      categoryId,
    });
  }

  linkCategoryToParent(childId: string, parentId: string): Observable<unknown> {
    return this.http.post(this.url('v1/category/child/add-exist'), {
      parentId,
      childId,
    });
  }

  linkCategoryToNewParent(
    childId: string,
    newParentTitle: string,
  ): Observable<unknown> {
    return this.http.post(this.url('v1/category/parent/add-as-new'), {
      childId,
      newParentTitle,
    });
  }

  unlinkCategoryFromParent(childId: string, parentId: string): Observable<unknown> {
    return this.http.post(this.url('v1/category/remove-child-from-parent'), {
      childId,
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
  ): Observable<CategoryAnalytics> {
    const params = new HttpParams()
      .set('dateFrom', formatApiDate(dateFrom))
      .set('dateTo', formatApiDate(dateTo))
      .set('targetCurrencyId', targetCurrencyId);

    return this.http
      .get<CategoryAnalyticsDto>(this.url('v1/analytics/by-date-range'), { params })
      .pipe(map(toCategoryAnalytics));
  }

  private url(path: string): string {
    return this.baseUrl + path;
  }
}
