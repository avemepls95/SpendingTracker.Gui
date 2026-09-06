import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface CurrentUserDto {
  readonly isAdmin: boolean;
}

/**
 * Маршруты о самом вызывающем.
 *
 * Живёт в core, а не в сервисе админского раздела: маршрут отвечает всем, и складывать его к
 * админским значило бы тянуть весь их граф в аутентификацию.
 */
@Injectable({ providedIn: 'root' })
export class UserApiService {
  private readonly http = inject(HttpClient);

  getCurrent(): Observable<CurrentUserDto> {
    return this.http.get<CurrentUserDto>(`${environment.spendingApi}v1/user/current`);
  }
}
