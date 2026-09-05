import { ChangeDetectionStrategy, Component, computed } from '@angular/core';

import { MaskFormat } from '../util/mask-input.util';
import { parseTime } from '../util/time.util';
import { IconComponent } from './icon.component';
import { MaskedPickerFieldBase } from './masked-picker-field.base';

/** Порядок частей времени в поле - он же подсказка внутри пустого поля. */
export const TIME_INPUT_FORMAT = 'чч:мм';

/** Маска чч:мм: часы и минуты стоят каждый на своих местах. */
const TIME_MASK: MaskFormat = {
  slots: [0, 1, 3, 4],
  separator: ':',
  segmentEnds: [1],
};

/**
 * Ошибка поля времени или null, если текст читается как время.
 *
 * Формулировки общие для всех форм: поле одно и то же, и разные тексты одной
 * и той же ошибки читались бы как разные проблемы.
 */
export function timeFieldError(text: string, emptyMessage = 'Укажите время'): string | null {
  if (text.trim() === '') {
    return emptyMessage;
  }

  return parseTime(text) ? null : `Время в формате ${TIME_INPUT_FORMAT}, 24 часа`;
}

/**
 * Поле ввода времени в формате чч:мм.
 *
 * Нативный `<input type="time">` показывает время в локали браузера, и в
 * системе с английской локалью владелец видел 10:00 AM вместо 24-часового
 * вида; форматом этого поля из кода не управлять. Поэтому время набирают в
 * текстовом поле с маской, а нативный выбор остаётся под кнопкой часов - на
 * телефоне колёсики удобнее набора с клавиатуры. Устроено так же, как поле
 * даты рядом с ним.
 *
 * Компонент отдаёт только сам контрол: подпись, рамку ошибки и текст ошибки
 * рисует форма так же, как у остальных своих полей.
 */
@Component({
  selector: 'app-time-input',
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
      <app-icon name="clock" />
    </button>

    <!-- Нативное поле лежит прозрачным слоем поверх кнопки по той же причине,
         что и у поля даты: в Safari на iOS нет showPicker(), и системный
         выбор там открывает только настоящее нажатие на сам input. -->
    <input
      #native
      class="picker-field__native"
      type="time"
      tabindex="-1"
      aria-hidden="true"
      [disabled]="disabled()"
      [value]="nativeValue()"
      (click)="onNativeClick()"
      (change)="onNativePick($event)"
    />
  `,
})
export class TimeInputComponent extends MaskedPickerFieldBase {
  protected readonly format = TIME_INPUT_FORMAT;

  protected readonly mask = TIME_MASK;

  protected readonly pickerLabel = computed(() => `Открыть выбор времени: ${this.label()}`);

  /** Значение нативного поля: выбор должен открыться на набранном времени. */
  protected readonly nativeValue = computed(() => parseTime(this.value()) ?? '');

  /**
   * Вставка готового времени из буфера.
   *
   * Часы без ведущего нуля и суффикс AM/PM приходят из внешних источников: по
   * одним цифрам маска разложила бы «9:30» как 93:0. Обрывок времени сюда не
   * попадает - его разберёт обычная маска по цифрам.
   */
  protected onPaste(event: ClipboardEvent): void {
    const pasted = parsePastedTime(event.clipboardData?.getData('text') ?? '');
    if (!pasted) {
      return;
    }

    event.preventDefault();
    this.apply(pasted, pasted.length);
  }

  protected onNativePick(event: Event): void {
    // Нативное поле отдаёт время в 24-часовом виде независимо от того, в
    // каком показывало его само.
    const picked = parseTime((event.target as HTMLInputElement).value);
    if (!picked) {
      return;
    }

    this.apply(picked, picked.length);
  }
}

/** Время из буфера: часы без ведущего нуля, лишние секунды и AM/PM. */
function parsePastedTime(text: string): string | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i.exec(text.trim());
  if (!match) {
    return null;
  }

  const suffix = match[3]?.toLowerCase();
  // 12 AM - полночь, 12 PM - полдень, остальные часы просто сдвигаются.
  const hours = suffix
    ? (Number(match[1]) % 12) + (suffix === 'pm' ? 12 : 0)
    : Number(match[1]);

  return parseTime(`${String(hours).padStart(2, '0')}:${match[2]}`);
}
