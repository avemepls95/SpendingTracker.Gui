/**
 * Работа с календарными датами.
 *
 * Трата привязана к дню, а не к моменту времени. Поэтому строка вида
 * `2026-08-28T00:00:00Z` разбирается по календарной части: `new Date(...)`
 * трактует её как полночь UTC и в поясах западнее Гринвича сдвигает дату
 * на предыдущие сутки.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const DOT_DATE = /^(\d{2})\.(\d{2})\.(\d{4})/;

/** Разбирает дату сервера в локальную полночь соответствующего дня. */
export function parseCalendarDate(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : startOfDay(value);
  }

  const iso = ISO_DATE.exec(value);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  const dotted = DOT_DATE.exec(value);
  if (dotted) {
    return new Date(Number(dotted[3]), Number(dotted[2]) - 1, Number(dotted[1]));
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed);
}

/** Формат, который ожидает сервер: dd.MM.yyyy. */
export function formatApiDate(date: Date): string {
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** Формат значения `<input type="date">`: yyyy-MM-dd. */
export function formatInputDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Ключ дня для группировки списка. */
export function dayKey(date: Date): string {
  return formatInputDate(date);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const result = startOfDay(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addMonths(date: Date, months: number): Date {
  const result = startOfDay(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function isSameDay(left: Date, right: Date): boolean {
  return dayKey(left) === dayKey(right);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

const WEEKDAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/**
 * Подпись дня для заголовка группы.
 *
 * «Сегодня» и «Вчера» читаются быстрее даты, а год показывается только когда
 * он отличается от текущего.
 */
export function formatDayLabel(date: Date, today = new Date()): string {
  if (isSameDay(date, today)) {
    return 'Сегодня';
  }

  if (isSameDay(date, addDays(today, -1))) {
    return 'Вчера';
  }

  const day = date.getDate();
  const month = MONTHS_GENITIVE[date.getMonth()];

  if (date.getFullYear() !== today.getFullYear()) {
    return `${day} ${month} ${date.getFullYear()}`;
  }

  return `${day} ${month}, ${WEEKDAYS_SHORT[date.getDay()]}`;
}

/** Короткая подпись даты для строк без группировки: 28.08.26. */
export function formatShortDate(date: Date): string {
  const year = String(date.getFullYear()).slice(-2);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${year}`;
}
