/** Три формы русского числительного: 1 трата, 2 траты, 5 трат. */
export type PluralForms = readonly [string, string, string];

/**
 * Выбирает форму слова по числу.
 *
 * Числа 11-14 идут третьей формой вопреки последней цифре: «11 трат», а не
 * «11 трата», - поэтому сотенный остаток проверяется до десятичного.
 */
export function plural(value: number, forms: PluralForms): string {
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

const SPENDING_FORMS: PluralForms = ['трата', 'траты', 'трат'];

/**
 * Формы для чисел 2-4 и 5+ совпадают не случайно: после предлога, требующего
 * косвенного падежа, множественное число идёт родительным при любом числе,
 * кроме оканчивающегося на «один», - «с 2 трат», а не «с 2 траты».
 */
const SPENDING_GENITIVE_FORMS: PluralForms = ['траты', 'трат', 'трат'];

/** «1 трата», «4 траты», «12 трат» - число вместе с согласованным словом. */
export function spendingsCount(value: number): string {
  return `${value} ${plural(value, SPENDING_FORMS)}`;
}

/**
 * То же в родительном падеже: «с 1 траты», «с 4 трат».
 *
 * Отдельная форма нужна предлогам: именительный после «снята с» дал бы
 * «снята с 4 траты».
 */
export function spendingsCountGenitive(value: number): string {
  return `${value} ${plural(value, SPENDING_GENITIVE_FORMS)}`;
}
