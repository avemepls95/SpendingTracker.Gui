import { Routes } from '@angular/router';

import { adminGuard } from './core/auth/admin.guard';
import { authGuard } from './core/auth/auth.guard';

/**
 * Заголовок берётся из данных маршрута, а не подбирается поиском по адресу.
 * Прежняя реализация искала пункт меню по router.url и падала на любом
 * адресе, которого нет в списке, - включая редирект с корня.
 */
export const routes: Routes = [
  {
    path: 'auth',
    title: 'Вход',
    loadComponent: () =>
      import('./features/auth/auth.page').then((m) => m.AuthPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/shell/shell.page').then((m) => m.ShellPage),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'spendings' },
      {
        path: 'spendings',
        title: 'Траты',
        loadComponent: () =>
          import('./features/spendings/spendings.page').then((m) => m.SpendingsPage),
      },
      {
        path: 'accounts',
        title: 'Счета',
        loadComponent: () =>
          import('./features/accounts/accounts.page').then((m) => m.AccountsPage),
      },
      {
        path: 'categories',
        title: 'Категории',
        loadComponent: () =>
          import('./features/categories/categories.page').then((m) => m.CategoriesPage),
      },
      {
        path: 'analytics',
        title: 'Аналитика',
        loadComponent: () =>
          import('./features/analytics/analytics.page').then((m) => m.AnalyticsPage),
      },
      {
        path: 'settings',
        title: 'Настройки',
        loadComponent: () =>
          import('./features/settings/settings.page').then((m) => m.SettingsPage),
      },
      {
        path: 'ai-usage',
        title: 'Расход на ИИ',
        // Guard - удобство: запрос в обход интерфейса всё равно получит от
        // админских маршрутов 404, потому что права проверяются на сервере.
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/ai-usage/ai-usage.page').then((m) => m.AiUsagePage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
