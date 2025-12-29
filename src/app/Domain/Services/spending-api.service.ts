import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable, EMPTY} from 'rxjs';
import {environment} from 'src/environments/environment';
import {GetSpendingsResponseItem} from "./Contracts/GetSpendingsResponseItem";
import {Spending} from "../Models/Spending";
import {GetAllCurrenciesResponseItem} from "./Contracts/GetAllCurrenciesResponseItem";
import {CategoryDto} from "./Contracts/CategoryDto";
import {Category} from "../Models/Category";
import {GetSpendingsWithCategoriesTreeRequest} from "./Contracts/GetSpendingsWithCategoriesTreeRequest";
import {CategoryAnalytics} from "../Models/Analytics/CategoryAnalytics";
import {GetFilteredSpendingsRequest} from "./Contracts/GetFilteredSpendingsRequest";
import {UserSettings} from "../Models/UserSettings";
import {GetUserAccountsResponse} from "./Contracts/Accounts/GetUserAccountsResponse";
import {CreateUserAccountRequest} from "./Contracts/Accounts/CreateUserAccountRequest";
import {UpdateUserAccountRequest} from "./Contracts/Accounts/UpdateUserAccountRequest";
import { DatePipe } from '@angular/common';


@Injectable({
  providedIn: 'root'
})
export class SpendingApiService {

  private apiBaseUrl: string;

  constructor(private http: HttpClient, private datePipe: DatePipe) {
    this.apiBaseUrl = environment.spendingApi;
  }

  getCategories(): Observable<CategoryDto[]> {
    return this.http.get(this.apiBaseUrl + 'v1/category/list') as Observable<CategoryDto[]>;
  }

  getSpendingById(id: string): Observable<GetSpendingsResponseItem> {
    const params = new HttpParams().set('id', id);

    return this.http.get(
      this.apiBaseUrl + 'v1/spending/get-by-id',
      { params }) as Observable<GetSpendingsResponseItem>;
  }

  getSpendingsWithCategoriesTree(request: GetSpendingsWithCategoriesTreeRequest): Observable<GetSpendingsResponseItem[]> {
    const params = new HttpParams()
      .set('offset', request.offset.toString())
      .set('count', request.count.toString())
      .set('searchString', request.searchString)
      .set('onlyWithoutCategories', request.onlyWithoutCategories);

    return this.http.get(this.apiBaseUrl + 'v1/spending/list-with-categories', { params }) as Observable<GetSpendingsResponseItem[]>;
  }

  getFilteredSpendings(request: GetFilteredSpendingsRequest): Observable<GetSpendingsResponseItem[]> {
    const params = new HttpParams()
      .set('targetCurrencyId', request.targetCurrencyId)
      .set('categoryId', request.categoryId)
      .set('dateFrom', new Date(request.dateFrom).toLocaleDateString())
      .set('dateTo', new Date(request.dateTo).toLocaleDateString());

    return this.http.get(this.apiBaseUrl + 'v1/spending/filtered-list', { params }) as Observable<GetSpendingsResponseItem[]>;
  }

  createCategory(title: string) {
    if (!title)
      throw Error("Внутренная ошибка. Пустое название категории.");

    return this.http.post(
      this.apiBaseUrl + 'v1/category/create',
      {
        title: title
      }
    );
  }

  deleteSpending(id: string) {
    if (!id)
      throw Error("Внутренная ошибка. Пустой идентификатор траты.");

    return this.http.post(
      this.apiBaseUrl + 'v1/spending/delete',
      {
        id: id
      }
    );
  }

  deleteCategory(id: string) {
    if (!id)
      throw Error("Внутренная ошибка. Пустой идентификатор категории.");

    return this.http.post(
      this.apiBaseUrl + 'v1/category/delete',
      {
        id: id
      }
    );
  }

  linkParentAndChild(parentId: string, childId: string) {
    if (!parentId || !childId) {
      throw Error("Внутренная ошибка. Некорректные входные данные.");
    }

    return this.http.post(
      this.apiBaseUrl + 'v1/category/child/add-exist',
      {
        parentId: parentId,
        childId: childId
      }
    );
  }

  addSpendingToNewCategory(spendingId: string, newCategoryTitle: string) {
    if (!newCategoryTitle || !spendingId) {
      throw Error("Внутренная ошибка. Некорректные входные данные.");
    }

    return this.http.post(
      this.apiBaseUrl + 'v1/spending/add-to-new-category',
      {
        newCategoryTitle: newCategoryTitle,
        spendingId: spendingId
      }
    );
  }

  addCategoryToNewParent(childId: string, newParentTitle: string) {
    if (!childId || !newParentTitle) {
      throw Error("Внутренная ошибка. Некорректные входные данные.");
    }

    return this.http.post(
      this.apiBaseUrl + 'v1/category/parent/add-as-new',
      {
        newParentTitle: newParentTitle,
        childId: childId
      }
    );
  }

  updateSpending(spending: Spending) {
    if (!spending || !spending.id)
      throw Error("Внутренная ошибка. Пустая трата.");

    return this.http.post(
      this.apiBaseUrl + 'v1/spending/update',
      {
        id: spending.id,
        amount: spending.amount,
        currencyId: spending.currencyId,
        date: spending.date,
        description: spending.description
      }
    );
  }

  linkCategoryWithSpending(spendingId: string, categoryId: string) {
    if (!spendingId || !categoryId)
      throw Error("Внутренная ошибка добавления траты в категорию. Один или оба параметры пустые.");

    return this.http.post(
      this.apiBaseUrl + 'v1/spending/add-to-exist-category',
      {
        spendingId: spendingId,
        categoryId: categoryId
      }
    );
  }

  removeSpendingFromCategory(spendingId: string, categoryId: string) {
    if (!spendingId || !categoryId)
      throw Error("Внутренная ошибка удаления траты из категории. Один или оба параметры пустые.");

    return this.http.post(
      this.apiBaseUrl + 'v1/spending/remove-from-category',
      {
        spendingId: spendingId,
        categoryId: categoryId
      }
    );
  }

  removeCategoryFromParent(childId: string, parentId: string) {
    if (!childId || !parentId)
      throw Error("Внутренная ошибка удаления категории из родительской. Один или оба параметры пустые.");

    return this.http.post(
      this.apiBaseUrl + 'v1/category/remove-child-from-parent',
      {
        childId: childId,
        parentId: parentId
      }
    );
  }

  getAllCurrencies(): Observable<GetAllCurrenciesResponseItem[]> {
    return this.http.get(this.apiBaseUrl + 'v1/currency/list') as Observable<GetAllCurrenciesResponseItem[]>;
  }

  updateCategory(category: Category) {
    if (!category || !category.id)
      throw Error("Внутренная ошибка. Пустая категория.");

    return this.http.post(
      this.apiBaseUrl + 'v1/category/update',
      {
        id: category.id,
        title: category.title
      }
    );
  }

  getCategoriesAnalytics(dateFrom: Date, dateTo: Date, currencyId: string): Observable<CategoryAnalytics> {
    const params = new HttpParams()
      .set('dateFrom', this.datePipe.transform(dateFrom, 'dd.MM.yyyy')!.toString())
      .set('dateTo', this.datePipe.transform(dateTo, 'dd.MM.yyyy')!.toString())
      .set('targetCurrencyId', currencyId);

    return this.http.get(this.apiBaseUrl + 'v1/analytics/by-date-range', {params}) as Observable<CategoryAnalytics>;
  }

  getUserSettings(): Observable<UserSettings> {
    return this.http.get(this.apiBaseUrl + 'v1/user-settings/list') as Observable<UserSettings>;
  }

  updateUserSettings(userSettings: UserSettings) {
    if (!userSettings || !userSettings.viewCurrencyId)
      throw Error("Внутренная ошибка. Пустые настройки пользователя.");

    return this.http.post(
      this.apiBaseUrl + 'v1/user-settings/update',
      {
        ViewCurrencyId: userSettings.viewCurrencyId
      }
    );
  }

  getUserAccounts(currencyId: string): Observable<GetUserAccountsResponse> {
    const params = new HttpParams()
      .set('currencyId', currencyId);

    return this.http.get(this.apiBaseUrl + 'v1/account/get-list-info', {params}) as Observable<GetUserAccountsResponse>;
  }

  createUserAccount(request: CreateUserAccountRequest) {
    if (!request || !request.amount || !request.name || !request.currencyId)
      throw Error("Внутренная ошибка. Некоррекотные данные счета.");

    return this.http.post(
      this.apiBaseUrl + 'v1/account/create',
      {
        name: request.name,
        type: request.type,
        currencyId: request.currencyId,
        amount: request.amount,
      }
    );
  }

  updateUserAccount(request: UpdateUserAccountRequest) {
    if (!request || !request.amount || !request.name || !request.currencyId)
      throw Error("Внутренная ошибка. Некорректные данные счета.");

    return this.http.post(
      this.apiBaseUrl + 'v1/account/update',
      {
        id: request.id,
        name: request.name,
        type: request.type,
        currencyId: request.currencyId,
        amount: request.amount,
      }
    );
  }

  deleteUserAccount(id: string) {
    if (!id)
      throw Error("Внутренная ошибка. Некорректный идентификатор счета.");

    return this.http.post(this.apiBaseUrl + 'v1/account/delete', { id: id });
  }
}
