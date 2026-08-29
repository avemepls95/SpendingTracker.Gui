import { IntervalUnit, RecurrenceInput } from '../../domain/models/models';
import { parseCalendarDate } from './date.util';

const UNIT_PLURALS: Record<IntervalUnit, readonly [string, string, string]> = {
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
    return `Однократно ${rule.startDate} в ${rule.startTime}`;
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
    unit === 'Hour' ? [period] : [period, dayPart(rule, unit), `в ${rule.startTime}`];

  if (rule.endDate) {
    parts.push(`до ${rule.endDate}`);
  }

  return parts.filter(Boolean).join(', ');
}

function dayPart(rule: RecurrenceInput, unit: IntervalUnit): string {
  // Дата разбирается, а не режется по позициям: в форму она попадает из
  // <input type="date"> в формате yyyy-MM-dd, и нарезка дала бы другое число.
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

function plural(value: number, forms: readonly [string, string, string]): string {
  const mod100 = Math.abs(value) % 100;
  const mod10 = mod100 % 10;

  if (mod100 > 10 && mod100 < 20) {
    return forms[2];
  }

  if (mod10 === 1) {
    return forms[0];
  }

  if (mod10 >= 2 && mod10 <= 4) {
    return forms[1];
  }

  return forms[2];
}
