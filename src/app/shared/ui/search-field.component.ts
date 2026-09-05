import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';

import { IconComponent } from './icon.component';

/**
 * Поле поиска: значок, ввод и крестик очистки.
 *
 * Полей поиска в приложении четыре - в списке трат и в трёх пикерах, - и
 * устроены они одинаково. Раньше каждое несло собственную копию разметки и
 * своей тройки классов, из-за чего крестик пришлось бы добавлять четырежды.
 */
@Component({
  selector: 'app-search-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="search-field">
      <app-icon class="search-field__icon" name="search" />
      <input
        #control
        class="field__control search-field__input"
        type="search"
        inputmode="search"
        autocomplete="off"
        [placeholder]="placeholder()"
        [value]="text()"
        (input)="onInput($event)"
      />
      @if (text() !== '') {
        <button
          type="button"
          class="search-field__clear"
          aria-label="Очистить поиск"
          (click)="clear()"
        >
          <app-icon name="close" />
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .search-field {
      position: relative;
    }

    .search-field__icon {
      position: absolute;
      top: 50%;
      left: var(--sp-3);
      transform: translateY(-50%);
      color: var(--c-text-3);
      --icon-size: 18px;
      pointer-events: none;
    }

    .search-field__input {
      padding-left: calc(var(--sp-3) + var(--sp-6));
      // Место под крестик держится всегда: появляйся оно вместе с кнопкой,
      // набранный текст дёргался бы влево на первой же букве.
      padding-right: var(--tap-min);
    }

    .search-field__clear {
      position: absolute;
      top: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: var(--tap-min);
      height: 100%;
      min-height: var(--tap-min);
      border-radius: var(--r-md);
      background: transparent;
      color: var(--c-text-3);
      transition: color var(--dur) var(--ease);
      --icon-size: 18px;

      &:active {
        color: var(--c-text);
      }
    }
  `,
})
export class SearchFieldComponent {
  readonly placeholder = input.required<string>();

  readonly value = input('');

  /**
   * Ставить ли курсор в поле сразу, как оно появилось.
   *
   * Пикеры открывают ради ввода, и лишнее касание по полю там только тянет
   * время. В списке трат поле появляется по кнопке, и курсор ставит сам экран:
   * возврат с соседнего раздела рисует поле заново и поднимал бы клавиатуру
   * без просьбы.
   */
  readonly autofocus = input(false);

  readonly valueChange = output<string>();

  private readonly control = viewChild.required<ElementRef<HTMLInputElement>>('control');

  /**
   * Текст поля, каким его видит владелец.
   *
   * Держится отдельно от привязки: наружу значение уходит с задержкой - список
   * трат ждёт паузу в наборе, - а крестик обязан появляться с первой буквой.
   */
  protected readonly text = linkedSignal(() => this.value());

  constructor() {
    // afterNextRender, а не ngAfterViewInit: контейнер CDK забирает фокус себе
    // в собственном ngAfterViewInit, и более ранний вызов он бы перебил.
    // preventScroll - чтобы поле не выдёргивало лист в кадр рывком.
    afterNextRender(() => {
      if (this.autofocus()) {
        this.control().nativeElement.focus({ preventScroll: true });
      }
    });
  }

  /** Ставит курсор в поле. Нужен там, где поиск открывают по кнопке. */
  focus(): void {
    this.control().nativeElement.focus();
  }

  protected onInput(event: Event): void {
    this.update((event.target as HTMLInputElement).value);
  }

  /**
   * Очистка крестиком.
   *
   * Фокус возвращается полю намеренно: очищают, чтобы набрать заново, и
   * уехавшая клавиатура заставила бы снова целиться в поле.
   */
  protected clear(): void {
    this.update('');
    this.focus();
  }

  private update(value: string): void {
    this.text.set(value);
    this.valueChange.emit(value);
  }
}
