/**
 * Работа со временем суток.
 *
 * Расписание срабатывает в часы и минуты пояса владельца, а не в момент
 * времени, и сервер шлёт и принимает их строкой HH:mm. Разбор идёт по самой
 * строке, без `new Date(...)`: тот для «25:00» молча дал бы следующие сутки, и
 * набранное руками время прошло бы проверку.
 */

// Секунды нативное поле времени добавляет при шаге меньше минуты - в поле они
// лишние, но пришедшее с ними значение читается.
const EXACT_TIME = /^(\d{2}):(\d{2})(?::\d{2})?$/;

/**
 * Строгий разбор времени в 24-часовом виде.
 *
 * Возвращает время в том же виде HH:mm, в котором оно хранится и уходит на
 * сервер, или null, если строка временем не читается.
 */
export function parseTime(value: string): string | null {
  const match = EXACT_TIME.exec(value.trim());
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  return hours < 24 && minutes < 60 ? `${pad(hours)}:${pad(minutes)}` : null;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
