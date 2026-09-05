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
import { IconComponent } from './icon.component';

/** Порядок частей даты в поле - он же подсказка внутри пустого поля. */
export const DATE_INPUT_FORMAT = 'дд.мм.гггг';

/** Разделитель, который маска расставляет сама. */
const SEPARATOR = '.';

/**
 * Места цифр в тексте дд.мм.гггг.
 *
 * Маска держит восемь неподвижных мест: день, месяц и год стоят каждый на
 * своём, и правка одного места не двигает остальные.
 */
const SLOTS = [0, 1, 3, 4, 6, 7, 8, 9];

/** Последние места дня и месяца: за ними маска сразу дописывает разделитель. */
const DAY_END = 1;
const MONTH_END = 3;

/** Знак незанятого места внутри даты: 06.__.2026. */
const BLANK = '_';

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
  imports: [IconComponent],
  template: `
    <input
      #control
      [id]="inputId()"
      class="field__control date-input__control"
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
      class="date-input__picker"
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
      class="date-input__native"
      type="date"
      tabindex="-1"
      aria-hidden="true"
      [disabled]="disabled()"
      [value]="nativeValue()"
      (click)="onNativeClick()"
      (change)="onNativePick($event)"
    />
  `,
  styles: `
    :host {
      position: relative;
      display: block;
    }

    .date-input__control {
      // Место справа под кнопку календаря: без него дата уходит под неё.
      padding-right: var(--tap-min);
      font-variant-numeric: tabular-nums;
    }

    .date-input__picker {
      position: absolute;
      top: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: var(--tap-min);
      height: 100%;
      min-height: var(--tap-min);
      border: 0;
      border-radius: var(--r-md);
      background: transparent;
      color: var(--c-text-3);
      transition: color var(--dur) var(--ease);
      --icon-size: 20px;

      &:active {
        color: var(--c-accent);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    // Нажатие достаётся слою, а не кнопке под ним, поэтому отклик кнопки
    // приходится вести по его состоянию.
    :host:has(.date-input__native:active) .date-input__picker {
      color: var(--c-accent);
    }

    .date-input__native {
      position: absolute;
      top: 0;
      right: 0;
      width: var(--tap-min);
      height: 100%;
      min-height: var(--tap-min);
      padding: 0;
      border: 0;
      background: transparent;
      // Полем пользуются вслепую - видно только кнопку под ним.
      opacity: 0;
      cursor: pointer;
      appearance: none;
      // Меньше 16px iOS считает поводом приблизить страницу при фокусе.
      font-size: 16px;

      &:disabled {
        pointer-events: none;
      }
    }
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
    const edited = editDate(this.text, element.value, caret);

    this.apply(edited.text, edited.caret);
  }

  /**
   * Стирание разделителя.
   *
   * Точку ставит маска, и удаление вернуло бы её на место - каретка застряла
   * бы перед ней. Вместо разделителя стирается цифра за ним.
   */
  protected onKeydown(event: KeyboardEvent): void {
    const element = event.target as HTMLInputElement;
    const start = element.selectionStart ?? 0;

    if (start !== element.selectionEnd) {
      return;
    }

    if (event.key === 'Backspace' && start >= 2 && element.value[start - 1] === SEPARATOR) {
      element.setSelectionRange(start - 1, start - 1);
      return;
    }

    if (event.key === 'Delete' && element.value[start] === SEPARATOR) {
      element.setSelectionRange(start + 1, start + 1);
    }
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
 * Правка даты по неподвижным местам сегментов.
 *
 * Браузер сообщает только итоговое содержимое поля, поэтому правка сначала
 * вычитается из него: `caret` стоит за вставленным, а совпадающий хвост
 * остался от прежнего текста. Набранная цифра занимает место под кареткой, а
 * не раздвигает соседние: иначе одна цифра, вписанная в середину заполненной
 * даты, сдвигала бы весь остаток и превращала 06.07.2026 в 01.60.7202.
 * Стёртое место остаётся пустым (06.__.2026) по той же причине - затянуть
 * дыру хвостом значит сдвинуть год в месяц.
 */
function editDate(previous: string, raw: string, caret: number): { text: string; caret: number } {
  const start = commonPrefix(previous, raw, caret);
  const inserted = raw.slice(start, caret);
  // Хвост правее каретки достался от прежнего текста - отсюда и правая
  // граница стёртого куска.
  const removedEnd = Math.max(start, previous.length - (raw.length - caret));

  const slots: (string | null)[] = SLOTS.map((position) => {
    const char = previous[position];
    const kept = char !== undefined && isDigit(char) ? char : null;

    return position >= start && position < removedEnd ? null : kept;
  });

  let slot = slotAt(start);

  for (const char of inserted) {
    if (!isDigit(char)) {
      continue;
    }

    if (slot >= SLOTS.length) {
      break;
    }

    slots[slot++] = char;
  }

  const text = renderDate(slots);

  return {
    text,
    caret: Math.min(slot < SLOTS.length ? SLOTS[slot] : text.length, text.length),
  };
}

/** Собирает текст поля по занятым местам, обрывая его на последней цифре. */
function renderDate(slots: (string | null)[]): string {
  let last = -1;

  for (let index = 0; index < slots.length; index++) {
    if (slots[index] !== null) {
      last = index;
    }
  }

  if (last < 0) {
    return '';
  }

  let text = '';

  for (let index = 0; index <= last; index++) {
    if (index === DAY_END + 1 || index === MONTH_END + 1) {
      text += SEPARATOR;
    }

    text += slots[index] ?? BLANK;
  }

  // Разделитель за готовым сегментом дописывается сразу: следующая цифра
  // должна набираться уже за ним, а не перед.
  return last === DAY_END || last === MONTH_END ? text + SEPARATOR : text;
}

/** Место, на которое попадёт цифра, набранная в позиции `caret`. */
function slotAt(caret: number): number {
  const slot = SLOTS.findIndex((position) => position >= caret);

  return slot === -1 ? SLOTS.length : slot;
}

/** Длина общего начала строк, но не длиннее `limit`. */
function commonPrefix(previous: string, raw: string, limit: number): number {
  let index = 0;

  while (index < limit && index < previous.length && previous[index] === raw[index]) {
    index++;
  }

  return index;
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

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9';
}
