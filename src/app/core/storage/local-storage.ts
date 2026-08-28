/**
 * Доступ к localStorage, не роняющий приложение.
 *
 * В приватном режиме и при запрете хранилища сайту обращение к localStorage
 * выбрасывает исключение, а не возвращает null.
 */
export const localStore = {
  read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  write(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Хранилище недоступно: настройка не переживёт перезагрузку, но
      // текущий сеанс должен продолжить работать.
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // См. выше.
    }
  },
};
