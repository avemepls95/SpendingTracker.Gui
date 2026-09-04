import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { SpendingCategorySource } from '../../domain/models/models';
import { IconComponent } from './icon.component';

/**
 * Метка происхождения категории траты.
 *
 * Догадка модели выделяется заметно, применённое прошлое решение - слабо, а
 * решение человека на самой трате не помечается вовсе: разница между ними в
 * том, нужно ли на разметку смотреть. Заметная метка означает «проверь»,
 * слабая - «это твоё прошлое решение, применённое автоматически».
 */
@Component({
  selector: 'app-markup-source-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (label(); as text) {
      <span
        class="mark"
        [class.mark--guess]="source() === 'Model'"
        role="img"
        [attr.aria-label]="text"
        [attr.title]="text"
      >
        <app-icon name="sparkle" />
      </span>
    }
  `,
  styles: `
    // display: contents, а не inline-flex: без метки хост обязан исчезнуть
    // полностью, иначе пустой элемент добирает промежуток flex-контейнера
    // и чип категории получает лишний отступ слева.
    :host {
      display: contents;
    }

    .mark {
      display: inline-flex;
      color: var(--c-text-3);
      --icon-size: 12px;
    }

    .mark--guess {
      color: var(--c-accent);
    }
  `,
})
export class MarkupSourceMarkComponent {
  /** null - категории нет либо ответ источника не несёт. */
  readonly source = input.required<SpendingCategorySource | null>();

  protected readonly label = computed<string | null>(() => {
    switch (this.source()) {
      case 'Model':
        return 'Категорию предложила модель - проверьте её';
      case 'History':
        return 'Категория применена по вашему прошлому решению';
      default:
        return null;
    }
  });
}
