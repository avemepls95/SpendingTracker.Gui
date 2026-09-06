import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { CurrentUserStore } from './current-user.store';

/**
 * Пускает в админский раздел только администратора.
 *
 * Это удобство, а не защита: запрос в обход интерфейса всё равно получит от
 * админских маршрутов 404. Guard лишь избавляет от экрана с пустыми панелями.
 */
export const adminGuard: CanActivateFn = async () => {
  const currentUser = inject(CurrentUserStore);
  const router = inject(Router);

  return (await currentUser.ensureLoaded()) ? true : router.createUrlTree(['/']);
};
