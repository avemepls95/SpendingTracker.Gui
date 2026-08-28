/**
 * Чтение срока жизни JWT.
 *
 * Заменяет @auth0/angular-jwt, из которого использовался единственный метод.
 */

interface JwtPayload {
  readonly exp?: number;
}

/** Возвращает момент истечения токена или null, если его нельзя разобрать. */
export function readTokenExpiration(token: string): Date | null {
  const payload = decodePayload(token);
  if (payload?.exp === undefined) {
    return null;
  }

  return new Date(payload.exp * 1000);
}

/**
 * Токен просрочен или испорчен.
 *
 * Запас в несколько секунд закрывает расхождение часов клиента и сервера:
 * без него запрос успевает уйти с токеном, который на сервере уже мёртв.
 */
export function isTokenExpired(token: string, skewSeconds = 10): boolean {
  const expiration = readTokenExpiration(token);
  if (!expiration) {
    return true;
  }

  return expiration.getTime() - skewSeconds * 1000 <= Date.now();
}

function decodePayload(token: string): JwtPayload | null {
  const segments = token.split('.');
  if (segments.length !== 3) {
    return null;
  }

  try {
    const json = atob(toBase64(segments[1]));
    // Кириллица и другие не-ASCII символы в полезной нагрузке приходят в UTF-8,
    // поэтому байты из atob нужно перекодировать, а не читать как есть.
    const decoded = decodeURIComponent(
      Array.from(json, (character) => {
        const code = character.charCodeAt(0).toString(16).padStart(2, '0');
        return `%${code}`;
      }).join(''),
    );

    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

/** base64url отличается от base64 алфавитом и отсутствием выравнивания. */
function toBase64(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  return base64 + padding;
}
