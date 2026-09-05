import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

import {
  formatApiDate,
  formatInputDate,
  parseApiDate,
  parseCalendarDate,
} from '../util/date.util';
import { MaskFormat, editMasked, skipSeparator } from '../util/mask-input.util';
import { IconComponent } from './icon.component';

/** Порядок частей даты в поле - он же подсказка внутри пустого поля. */
export const DATE_INPUT_FORMAT = 'дд.мм.гггг';

/** Маска дд.мм.гггг: день, месяц и год стоят каждый на своих местах. */
const DATE_MASK: MaskFormat = {
  slots: [0, 1, 3, 4, 6, 7, 8, 9],
  separator: '.',
  segmentEnds: [1, 3],
};

/**
 * Ошибка поля даты или null, если текст читается как дата.
 *
 * Формулировки общие для всех форм: поле одно и то же, и разные тексты одной
 * и той же ошибки читались бы как разные проблемы.
 */
export function dateFieldError(text: string, emptyMessage = 'Укажите дату'): string | null {
  if (text.trim() === '') {
    return emptyMessage;
  }

  return parseApiDate(text) ? null : `Дата в формате ${DATE_INPUT_FORMAT}`;
}

/**
 * Поле ввода даты в формате дд.мм.гггг.
 *
 * Нативный `<input type="date">` показывает дату в локали браузера, и в
 * системе с английской локалью владелец видел 06/07/2026 вместо привычного
 * порядка; форматом этого поля из кода не управлять. Поэтому дату набирают в
 * текстовом поле с маской, а нативный выбор остаётся под кнопкой календаря -
 * на телефоне колёсики удобнее набора с клавиатуры.
 *
 * Компонент отдаёт только сам контрол: подпись, рамку ошибки и текст ошибки
 * рисует форма так же, как у остальных своих полей.
 */
@Component({
  selector: 'app-date-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'picker-field' },
  imports: [IconComponent],
  template: `
    <input
      #control
      [id]="inputId()"
      class="field__control picker-field__control"
      [class.field__control--invalid]="invalid()"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      [placeholder]="format"
      [disabled]="disabled()"
      [attr.aria-invalid]="invalid() ? true : null"
      [attr.aria-describedby]="describedBy()"
      (keydown)="onKeydown($event)"
      (paste)="onPaste($event)"
      (input)="onInput($event)"
    />

    <button
      type="button"
      class="picker-field__button"
      [attr.aria-label]="pickerLabel()"
      [disabled]="disabled()"
      (click)="openPicker()"
    >
      <app-icon name="calendar" />
    </button>

    <!-- Нативное поле лежит прозрачным слоем поверх кнопки, а не спрятано
         рядом с ней: в Safari на iOS нет showPicker() (WebKit #261703), и
         системный календарь там открывает только настоящее нажатие на сам
         input. Для остальных браузеров, где нажатие на поле календарь не
         раскрывает, тот же обработчик зовёт showPicker(). -->
    <input
      #native
      class="picker-field__native"
      type="date"
      tabindex="-1"
      aria-hidden="true"
      [disabled]="disabled()"
      [value]="nativeValue()"
      (click)="onNativeClick()"
      (change)="onNativePick($event)"
    />
  `,
})
export class DateInputComponent {
  /** Дата в формате дд.мм.гггг; пустая строка - поле не заполнено. */
  readonly value = input.required<string>();

  /** Идентификатор контрола: по нему форма связывает поле со своей подписью. */
  readonly inputId = input.required<string>();

  /** Подпись поля: уточняет, какой именно календарь откроет кнопка. */
  readonly label = input.required<string>();

  readonly invalid = input(false);
  readonly disabled = input(false);
  readonly describedBy = input<string | null>(null);

  readonly valueChange = output<string>();

  protected readonly format = DATE_INPUT_FORMAT;

  private readonly control = viewChild.required<ElementRef<HTMLInputElement>>('control');
  private readonly native = viewChild.required<ElementRef<HTMLInputElement>>('native');

  /**
   * Текст, стоявший в поле до последней правки.
   *
   * По нему маска отличает вставленное от стёртого: браузер сообщает только
   * итоговое содержимое, а места цифр надо разложить по сегментам.
   */
  private text = '';

  protected readonly pickerLabel = computed(() => `Открыть календарь: ${this.label()}`);

  /** Значение нативного поля: календарь должен открыться на набранной дате. */
  protected readonly nativeValue = computed(() => {
    const date = parseApiDate(this.value());

    return date ? formatInputDate(date) : '';
  });

  constructor() {
    // Значение переносится в DOM вручную, а не привязкой [value]: маска правит
    // набранное прямо в поле, и повторная запись той же строки привязкой
    // сбрасывала бы каретку в конец.
    effect(() => {
      const text = this.value();
      const element = this.control().nativeElement;

      if (element.value !== text) {
        element.value = text;
      }

      this.text = text;
    });
  }

  protected onInput(event: Event): void {
    const element = event.target as HTMLInputElement;
    const caret = element.selectionStart ?? element.value.length;
    const edited = editMasked(DATE_MASK, this.text, element.value, caret);

    this.apply(edited.text, edited.caret);
  }

  protected onKeydown(event: KeyboardEvent): void {
    skipSeparator(event.target as HTMLInputElement, event.key, DATE_MASK.separator);
  }

  /**
   * Вставка целой даты из буфера.
   *
   * Из приложения и с сервера дата копируется как дд.мм.гггг, из внешних
   * источников - чаще как гггг-мм-дд. Обрывок даты сюда не попадает: его
   * разберёт обычная маска по цифрам.
   */
  protected onPaste(event: ClipboardEvent): void {
    const pasted = parsePastedDate(event.clipboardData?.getData('text') ?? '');
    if (!pasted) {
      return;
    }

    event.preventDefault();
    this.applyDate(pasted);
  }

  /** Открывает календарь с кнопки - с клавиатуры или из скринридера. */
  protected openPicker(): void {
    const native = this.native().nativeElement;

    try {
      native.showPicker();
    } catch {
      // showPicker() нет в Safari на iOS и он отказывает вне жеста
      // пользователя. Фокус на нативном поле открывает выбор сам - на
      // телефоне это тот же системный календарь.
      native.focus();
    }
  }

  /** Нажатие на прозрачный слой над кнопкой. */
  protected onNativeClick(): void {
    try {
      this.native().nativeElement.showPicker();
    } catch {
      // В Safari на iOS метода нет, но там календарь уже открыт самим
      // нажатием на нативное поле - делать больше нечего.
    }
  }

  protected onNativePick(event: Event): void {
    // Календарь отдаёт гггг-мм-дд и заведомо существующий день.
    const picked = parseCalendarDate((event.target as HTMLInputElement).value);
    if (!picked) {
      return;
    }

    this.applyDate(picked);
  }

  /** Ставит в поле готовую дату целиком - из календаря или из буфера. */
  private applyDate(date: Date): void {
    const text = formatApiDate(date);

    this.apply(text, text.length);
  }

  /** Пишет текст в поле, ставит каретку и сообщает форме о новом значении. */
  private apply(text: string, caret: number): void {
    const element = this.control().nativeElement;

    element.value = text;
    element.setSelectionRange(caret, caret);

    this.text = text;

    if (text !== this.value()) {
      this.valueChange.emit(text);
    }
  }
}

/**
 * Разбор даты из буфера.
 *
 * Время у ISO-момента отбрасывается: копируют обычно дату целиком
 * (2026-07-06T00:00:00.000Z), а в поле хранится календарный день.
 */
function parsePastedDate(text: string): Date | null {
  const trimmed = text.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(trimmed);

  return iso
    ? parseApiDate(`${iso[3]}.${iso[2]}.${iso[1]}`)
    : parseApiDate(trimmed);
}
