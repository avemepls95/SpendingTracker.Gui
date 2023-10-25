import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, EMPTY } from 'rxjs';
import { environment } from 'src/environments/environment';
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

  updateSpending(spending: Spending){
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

  getAllCurrencies(): Observable<GetAllCurrenciesResponseItem[]> {
    return this.http.get(this.apiBaseUrl + 'v1/currency/list') as Observable<GetAllCurrenciesResponseItem[]>;
  }
}
