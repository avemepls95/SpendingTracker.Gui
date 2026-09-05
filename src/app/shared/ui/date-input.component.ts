import { ChangeDetectionStrategy, Component, computed } from '@angular/core';

import {
  formatApiDate,
  formatInputDate,
  parseApiDate,
  parseCalendarDate,
} from '../util/date.util';
import { MaskFormat } from '../util/mask-input.util';
import { IconComponent } from './icon.component';
import { MaskedPickerFieldBase } from './masked-picker-field.base';

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
export class DateInputComponent extends MaskedPickerFieldBase {
  protected readonly format = DATE_INPUT_FORMAT;

  protected readonly mask = DATE_MASK;

  protected readonly pickerLabel = computed(() => `Открыть календарь: ${this.label()}`);

  /** Значение нативного поля: календарь должен открыться на набранной дате. */
  protected readonly nativeValue = computed(() => {
    const date = parseApiDate(this.value());

    return date ? formatInputDate(date) : '';
  });

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
