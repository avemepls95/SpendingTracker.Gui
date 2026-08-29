import {
  INTERVAL_UNIT_LABELS,
  IntervalUnit,
  RecurrenceInput,
} from '../../domain/models/models';

const UNIT_PLURALS: Record<IntervalUnit, readonly [string, string, string]> = {
  Hour: ['час', 'часа', 'часов'],
  Day: ['день', 'дня', 'дней'],
  Week: ['неделю', 'недели', 'недель'],
  Month: ['месяц', 'месяца', 'месяцев'],
  Year: ['год', 'года', 'лет'],
};

/**
 * Человекочитаемая периодичность: «раз в месяц, 15-го, в 10:00».
 * Без неё пользователь не может проверить, что настроил то, что хотел.
 */
export function describeRecurrence(rule: RecurrenceInput): string {
  if (rule.recurrenceKind === 'Once') {
    return `Однократно ${rule.startDate} в ${rule.startTime}`;
  }

  const unit = rule.intervalUnit;
  if (!unit) {
    return 'Периодичность не задана';
  }

  const period =
    rule.intervalValue === 1
      ? `раз в ${UNIT_PLURALS[unit][0]}`
      : `раз в ${rule.intervalValue} ${plural(rule.intervalValue, UNIT_PLURALS[unit])}`;

  // Для часового интервала время в сутках не фиксировано, показывать его нечестно.
  if (unit === 'Hour') {
    return period;
  }

  const day = dayPart(rule, unit);

  return [period, day, `в ${rule.startTime}`].filter(Boolean).join(', ');
}

export function unitLabel(unit: IntervalUnit): string {
  return INTERVAL_UNIT_LABELS[unit];
}

function dayPart(rule: RecurrenceInput, unit: IntervalUnit): string {
  if (unit === 'Month') {
    return `${Number(rule.startDate.slice(0, 2))}-го`;
  }

  if (unit === 'Year') {
    return rule.startDate.slice(0, 5);
  }

  return '';
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
