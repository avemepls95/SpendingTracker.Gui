import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { TelegramService } from '../../core/telegram/telegram.service';
import { IconComponent, IconName } from '../../shared/ui/icon.component';

interface TabItem {
  readonly route: string;
  readonly label: string;
  readonly icon: IconName;
}

/**
 * Нижняя панель разделов.
 *
 * Заменяет выдвижное меню: на телефоне оно требовало двух касаний и пряталось
 * за иконкой в углу, тогда как большой палец достаёт до низа экрана.
 */
@Component({
  selector: 'app-tab-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  template: `
    <nav class="tab-bar">
      @for (tab of tabs; track tab.route) {
        <a
          class="tab"
          [routerLink]="tab.route"
          routerLinkActive="tab--active"
          #link="routerLinkActive"
          [attr.aria-current]="link.isActive ? 'page' : null"
          (click)="onSelect()"
        >
          <app-icon class="tab__icon" [name]="tab.icon" />
          <span class="tab__label">{{ tab.label }}</span>
        </a>
      }
    </nav>
  `,
  styleUrl: './tab-bar.component.scss',
})
export class TabBarComponent {
  private readonly telegram = inject(TelegramService);

  protected readonly tabs: readonly TabItem[] = [
    { route: '/spendings', label: 'Траты', icon: 'receipt' },
    { route: '/analytics', label: 'Аналитика', icon: 'chart' },
    { route: '/accounts', label: 'Счета', icon: 'wallet' },
    { route: '/categories', label: 'Категории', icon: 'tag' },
    { route: '/settings', label: 'Ещё', icon: 'sliders' },
  ];

  protected onSelect(): void {
    this.telegram.selectionChanged();
  }
}
