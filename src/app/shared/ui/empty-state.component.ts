import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { IconComponent, IconName } from './icon.component';

/**
 * Пустое состояние.
 *
 * Объясняет, почему здесь ничего нет и что делать дальше. Немая пустая область
 * неотличима от сбоя: именно так выглядел экран аналитики, когда траты за
 * период не были разнесены по категориям.
 */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="empty">
      <div class="empty__mark" aria-hidden="true">
        <app-icon [name]="icon()" />
      </div>
      <p class="empty__title">{{ title() }}</p>
      @if (hint()) {
        <p class="empty__hint">{{ hint() }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: `
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-2);
      padding: var(--sp-10) var(--sp-6);
      text-align: center;
    }

    .empty__mark {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      margin-bottom: var(--sp-2);
      border-radius: var(--r-full);
      background: var(--c-surface-2);
      color: var(--c-text-2);
      --icon-size: 26px;
    }

    .empty__title {
      font-size: var(--fs-title);
      font-weight: var(--fw-semibold);
    }

    .empty__hint {
      max-width: 34ch;
      color: var(--c-text-2);
      font-size: var(--fs-sm);
    }
  `,
})
export class EmptyStateComponent {
  readonly icon = input<IconName>('inbox');
  readonly title = input.required<string>();
  readonly hint = input<string>('');
}
