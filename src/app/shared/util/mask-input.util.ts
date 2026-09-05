/**
 * Маска ввода по неподвижным местам: дд.мм.гггг, чч:мм.
 *
 * Нативные `<input type="date">` и `<input type="time">` показывают значение в
 * локали браузера, и в системе с английской локалью владелец видел 06/07/2026
 * и 10:00 AM; форматом этих полей из кода не управлять. Поэтому значение
 * набирают в обычном текстовом поле, а маска раскладывает набранные цифры по
 * сегментам.
 */

/** Знак незанятого места внутри значения: 06.__.2026. */
const BLANK = '_';

/** Разметка маски: где стоят цифры и после каких из них идёт разделитель. */
export interface MaskFormat {
  /**
   * Места цифр в тексте маски.
   *
   * Маска держит их неподвижными: каждый сегмент стоит на своём месте, и
   * правка одного места не двигает остальные.
   */
  readonly slots: readonly number[];

  /** Разделитель, который маска расставляет сама. */
  readonly separator: string;

  /**
   * Номера последних мест сегментов - счёт по `slots`, а не по тексту.
   *
   * За таким местом маска сразу дописывает разделитель.
   */
  readonly segmentEnds: readonly number[];
}

/** Итог правки: что стоит в поле и где после этого каретка. */
export interface MaskEdit {
  readonly text: string;
  readonly caret: number;
}

/**
 * Правка значения по неподвижным местам сегментов.
 *
 * Браузер сообщает только итоговое содержимое поля, поэтому правка сначала
 * вычитается из него: `caret` стоит за вставленным, а совпадающий хвост
 * остался от прежнего текста. Набранная цифра занимает место под кареткой, а
 * не раздвигает соседние: иначе одна цифра, вписанная в середину заполненной
 * даты, сдвигала бы весь остаток и превращала 06.07.2026 в 01.60.7202.
 * Стёртое место остаётся пустым (06.__.2026) по той же причине - затянуть
 * дыру хвостом значит сдвинуть год в месяц.
 */
export function editMasked(
  format: MaskFormat,
  previous: string,
  raw: string,
  caret: number,
): MaskEdit {
  const start = commonPrefix(previous, raw, caret);
  const inserted = raw.slice(start, caret);
  // Хвост правее каретки достался от прежнего текста - отсюда и правая
  // граница стёртого куска.
  const removedEnd = Math.max(start, previous.length - (raw.length - caret));

  const slots: (string | null)[] = format.slots.map((position) => {
    const char = previous[position];
    const kept = char !== undefined && isDigit(char) ? char : null;

    return position >= start && position < removedEnd ? null : kept;
  });

  let slot = slotAt(format, start);

  for (const char of inserted) {
    if (!isDigit(char)) {
      continue;
    }

    if (slot >= format.slots.length) {
      break;
    }

    slots[slot++] = char;
  }

  const text = renderMasked(format, slots);

  return {
    text,
    caret: Math.min(slot < format.slots.length ? format.slots[slot] : text.length, text.length),
  };
}

/**
 * Пропуск разделителя при стирании.
 *
 * Разделитель ставит маска, и удаление вернуло бы его на место - каретка
 * застряла бы перед ним. Вместо разделителя стирается цифра за ним.
 */
export function skipSeparator(
  element: HTMLInputElement,
  key: string,
  separator: string,
): void {
  const start = element.selectionStart ?? 0;

  if (start !== element.selectionEnd) {
    return;
  }

  if (key === 'Backspace' && start >= 2 && element.value[start - 1] === separator) {
    element.setSelectionRange(start - 1, start - 1);
    return;
  }

  if (key === 'Delete' && element.value[start] === separator) {
    element.setSelectionRange(start + 1, start + 1);
  }
}

/** Собирает текст поля по занятым местам, обрывая его на последней цифре. */
function renderMasked(format: MaskFormat, slots: (string | null)[]): string {
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
    if (format.segmentEnds.includes(index - 1)) {
      text += format.separator;
    }

    text += slots[index] ?? BLANK;
  }

  // Разделитель за готовым сегментом дописывается сразу: следующая цифра
  // должна набираться уже за ним, а не перед.
  return format.segmentEnds.includes(last) ? text + format.separator : text;
}

/** Место, на которое попадёт цифра, набранная в позиции `caret`. */
function slotAt(format: MaskFormat, caret: number): number {
  const slot = format.slots.findIndex((position) => position >= caret);

  return slot === -1 ? format.slots.length : slot;
}

/** Длина общего начала строк, но не длиннее `limit`. */
function commonPrefix(previous: string, raw: string, limit: number): number {
  let index = 0;

  while (index < limit && index < previous.length && previous[index] === raw[index]) {
    index++;
  }

  return index;
}

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9';
}
