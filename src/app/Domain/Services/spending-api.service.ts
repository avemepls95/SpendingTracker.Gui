import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable, EMPTY} from 'rxjs';
import {environment} from 'src/environments/environment';
import {GetSpendingsResponseItem} from "./Contracts/GetSpendingsResponseItem";
import {Spending} from "../Models/Spending";
import {GetAllCurrenciesResponseItem} from "./Contracts/GetAllCurrenciesResponseItem";
import {CategoryDto} from "./Contracts/CategoryDto";


@Injectable({
  providedIn: 'root'
})
export class SpendingApiService {

  private apiBaseUrl: string;

  constructor(private http: HttpClient) {
    this.apiBaseUrl = environment.spendingApi;
  }

  getCategories(): Observable<CategoryDto[]> {
    return this.http.get(this.apiBaseUrl + 'v1/category/list') as Observable<CategoryDto[]>;
  }

  getSpendings(): Observable<GetSpendingsResponseItem[]> {
    return this.http.get(this.apiBaseUrl + 'v1/spending/list') as Observable<GetSpendingsResponseItem[]>;
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
}
