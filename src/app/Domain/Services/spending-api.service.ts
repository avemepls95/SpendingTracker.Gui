import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, EMPTY } from 'rxjs';
import { environment } from 'src/environments/environment';
import {GetCategoriesResponseItem} from "./Contracts/GetCategoriesResponseItem";


@Injectable({
  providedIn: 'root'
})
export class SpendingApiService {

  private apiBaseUrl: string;

  constructor(private http: HttpClient) {
    this.apiBaseUrl = environment.spendingApi;
  }

  getUsersSuggestion(query: string): Observable<any> {
    if (!query)
      return EMPTY;

    const params = new HttpParams()
      .set('query', query);

    return this.http.get(this.apiBaseUrl + 'users/search', { params });
  }

  getCategories(): Observable<GetCategoriesResponseItem[]> {
    return this.http.get(this.apiBaseUrl + 'v1/category/list') as Observable<GetCategoriesResponseItem[]>;
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
}
