/**
 * Ссылка на флаг по emoji-коду валюты.
 *
 * Прежняя реализация держала словарь на шесть флагов, и для любой другой
 * валюты в разметку уходило `<img src="undefined">`. Символы-индикаторы
 * regional indicator (U+1F1E6..U+1F1FF) отображаются на буквы A..Z, поэтому
 * код страны выводится из самого emoji и работает для всех валют.
 */

const REGIONAL_INDICATOR_A = 0x1f1e6;
const LETTER_A = 'A'.charCodeAt(0);

/** ISO-код страны в нижнем регистре или null. */
function toCountryCode(flagEmoji: string): string | null {
  const codePoints = Array.from(flagEmoji, (character) => character.codePointAt(0));
  const letters = codePoints
    .filter((point): point is number => point !== undefined)
    .filter((point) => point >= REGIONAL_INDICATOR_A && point <= REGIONAL_INDICATOR_A + 25)
    .map((point) => String.fromCharCode(LETTER_A + point - REGIONAL_INDICATOR_A));

  return letters.length === 2 ? letters.join('').toLowerCase() : null;
}

/**
 * Ссылка на изображение флага или null, если код нераспознан.
 *
 * Флаги показываются только в выборе валюты: в списке трат по флагу на строку
 * означало бы отдельный сетевой запрос на каждую запись.
 */
export function flagImageUrl(flagEmoji: string): string | null {
  const country = toCountryCode(flagEmoji);
  return country ? `https://flagcdn.com/w40/${country}.png` : null;
}
