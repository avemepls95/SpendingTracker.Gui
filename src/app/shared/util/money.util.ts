/**
 * Форматирование сумм.
 *
 * В прежнем интерфейсе суммы выводились сырым значением - `27808` вместо
 * `27 808`, - из-за чего порядок величины приходилось считать глазами.
 */

const formatters = new Map<string, Intl.NumberFormat>();

/**
 * Сумма с разделителями разрядов.
 *
 * Дробная часть показывается, только если она есть: столбец сумм, где у всех
 * записей висит `,00`, читается хуже.
 */
export function formatAmount(amount: number, forceFraction = false): string {
  const hasFraction = forceFraction || !Number.isInteger(round2(amount));
  const key = hasFraction ? 'fraction' : 'whole';

  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: hasFraction ? 2 : 0,
    });
    formatters.set(key, formatter);
  }

  // Узкий неразрывный пробел из ru-RU ломает выравнивание табличных цифр,
  // поэтому разделитель разрядов приводится к обычному неразрывному.
  return formatter.format(round2(amount)).replace(/\u202f/g, '\u00a0');
}

/** Разбирает введённую сумму: принимает и запятую, и точку. */
export function parseAmount(value: string): number | null {
  const normalized = value.replace(/\s|\u00a0/g, '').replace(',', '.');
  if (normalized === '' || !/^-?\d*\.?\d*$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
