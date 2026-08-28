/** Данные, которые виджет входа Telegram передаёт в колбэк. */
export interface TelegramWidgetAuthData {
  readonly auth_date: string;
  readonly first_name: string;
  readonly hash: string;
  readonly id: number;
  readonly last_name: string;
  readonly photo_url: string;
  readonly username: string;
}

export interface TelegramAuthRequest {
  readonly firstName: string;
  readonly lastName: string;
  readonly userId: number;
  readonly username: string;
  readonly checkString: string;
  readonly authType: 'widget' | 'webApp';
}

export interface TokenInformation {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: string;
}

export interface AuthByTelegramResponse {
  readonly tokenInformation: TokenInformation;
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
}

/**
 * Собирает строку проверки для виджета входа.
 *
 * Формат намеренно совпадает с прежней реализацией: порядок ключей исходного
 * объекта, поле hash включено. Сервер разбирает строку именно в таком виде,
 * поэтому приведение к каноническому формату Telegram сломало бы вход.
 */
export function buildWidgetCheckString(data: TelegramWidgetAuthData): string {
  return Object.entries(data)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('&');
}
