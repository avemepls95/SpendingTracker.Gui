import { IntervalUnit, RecurrenceInput } from '../../domain/models/models';
import { formatApiDate, parseCalendarDate } from './date.util';
import { PluralForms, plural } from './plural.util';
import { formatTimeLabel } from './time.util';

const UNIT_PLURALS: Record<IntervalUnit, PluralForms> = {
  Hour: ['час', 'часа', 'часов'],
  Day: ['день', 'дня', 'дней'],
  Week: ['неделю', 'недели', 'недель'],
  Month: ['месяц', 'месяца', 'месяцев'],
  Year: ['год', 'года', 'лет'],
};

/** Подпись единицы, согласованная с числом: «неделю», «недели», «недель». */
export function intervalUnitLabel(unit: IntervalUnit, count: number): string {
  return plural(count, UNIT_PLURALS[unit]);
}

/** Человекочитаемая периодичность: «раз в месяц, 15-го, в 10:00, до 31.12.2026». */
export function describeRecurrence(rule: RecurrenceInput): string {
  if (rule.recurrenceKind === 'Once') {
    return ['Однократно', datePart(rule.startDate), timePart(rule.startTime)]
      .filter(Boolean)
      .join(' ');
  }

  const unit = rule.intervalUnit;
  // Правило собирается по мере ввода, поэтому шаг может быть ещё не набран.
  if (!unit || !Number.isInteger(rule.intervalValue) || rule.intervalValue < 1) {
    return 'Периодичность не задана';
  }

  const period =
    rule.intervalValue === 1
      ? `раз в ${UNIT_PLURALS[unit][0]}`
      : `раз в ${rule.intervalValue} ${plural(rule.intervalValue, UNIT_PLURALS[unit])}`;

  // Для часового интервала время в сутках не фиксировано, показывать его нечестно.
  const parts =
    unit === 'Hour' ? [period] : [period, dayPart(rule, unit), timePart(rule.startTime)];

  if (rule.endDate) {
    parts.push(`до ${datePart(rule.endDate)}`);
  }

  return parts.filter(Boolean).join(', ');
}

/**
 * Время суток в подписи: «в 10:00».
 *
 * Правило приходит и из формы, и из ответа сервера, а тот отдаёт время и с
 * секундами: без нормализации подпись читалась бы «в 10:00:00».
 */
function timePart(startTime: string): string {
  const time = formatTimeLabel(startTime);

  return time ? `в ${time}` : '';
}

/** Дата в подписи: печатается заново, чтобы срезать пришедшее с ней время. */
function datePart(value: string): string {
  const date = parseCalendarDate(value);

  return date ? formatApiDate(date) : value.trim();
}

function dayPart(rule: RecurrenceInput, unit: IntervalUnit): string {
  // Дата разбирается, а не режется по позициям: правило собирается и из формы,
  // и из ответа сервера, и нарезка по позициям зависела бы от их формата.
  const anchor = parseCalendarDate(rule.startDate);
  if (!anchor) {
    return '';
  }

  if (unit === 'Month') {
    return monthDayPart(anchor.getDate());
  }

  if (unit === 'Year') {
    return `${pad(anchor.getDate())}.${pad(anchor.getMonth() + 1)}`;
  }

  return '';
}

/** Якорь 29-31 числа сервер обрезает по длине месяца, поэтому число не обещаем. */
function monthDayPart(day: number): string {
  return day <= 28 ? `${day}-го` : `${day}-го или в последний день месяца`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
