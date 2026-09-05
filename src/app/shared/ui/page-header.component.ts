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
      // Полоса тянется во всю ширину ради фона и липкости, а содержимое
      // встаёт по левому краю панелей страницы: они лежат в колонке
      // --content-max, у которой есть собственный отступ --sp-4. Без слагаемого
      // заголовок вставал бы на этот отступ левее списка, а без max() терял бы
      // поля на узком экране.
      padding: 0
        max(var(--sp-4), calc((100% - var(--content-max)) / 2 + var(--sp-4)));
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
