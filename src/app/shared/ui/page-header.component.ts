import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Заголовок экрана.
 *
 * Лежит на фоне страницы, а не на собственной цветной полосе: внутри Telegram
 * сверху уже висит шапка клиента, и вторая панель того же веса съедала высоту
 * и читалась как дубль.
 */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-header">
      <h1 class="page-header__title">{{ title() }}</h1>
      <div class="page-header__actions">
        <ng-content />
      </div>
    </header>
  `,
  styles: `
    .page-header {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      // Высота задана точно, а не через min-height: на неё опирается
      // смещение липкой панели фильтров, и расхождение оставляло бы щель,
      // сквозь которую при прокрутке видно список.
      height: calc(var(--appbar-h) + var(--safe-top));
      padding: 0 var(--sp-4);
      padding-top: var(--safe-top);
      background: var(--c-bg);
    }

    .page-header__title {
      flex: 1;
      min-width: 0;
      font-size: var(--fs-h1);
      font-weight: var(--fw-bold);
      letter-spacing: -0.02em;
    }

    .page-header__actions {
      display: flex;
      align-items: center;
      gap: var(--sp-1);
    }
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
}
