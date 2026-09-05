/**
 * Самолечение от устаревшего документа.
 *
 * index.html собирается без хеша в имени и жёстко ссылается на бандлы своей
 * сборки, поэтому его устаревшая копия - это устаревшее приложение целиком.
 * Пока nginx отдавал index.html вообще без заголовков кеширования, WebView
 * сохранял ответ и считал его свежим по эвристике (доля от возраста файла),
 * то есть неделями отдавал старую страницу, ни разу не спросив сервер.
 * Заголовки на сервере действуют только на новые ответы и не выселяют уже
 * сохранённую запись, поэтому приложение дополнительно проверяет само себя:
 * сверяет бандл, который выполняется, с бандлом из index.html, запрошенного
 * в обход кеша.
 */

/** Ключ сеанса вкладки, а не localStorage: следующий сеанс должен иметь право лечиться заново. */
const RELOAD_FLAG = 'moneytrace.stale-build-reloaded';

/**
 * Потолок ожидания index.html.
 *
 * Пяти секунд хватает и медленной мобильной сети, а дальше лечиться уже поздно:
 * пользователь всё это время работает в старой версии, и перезагрузка из-под
 * начатого ввода навредит больше, чем протухший бандл.
 */
const FETCH_TIMEOUT_MS = 5000;

/**
 * Перезагружает страницу, если выполняется не та сборка, что лежит на сервере.
 */
export async function reloadIfStaleBuild(): Promise<void> {
  const running = bundleOf(document);
  if (!running) {
    return;
  }

  const published = await publishedBundle();
  if (!published || published === running) {
    return;
  }

  // Перезагрузка ровно одна за сеанс вкладки. Если reload по какой-то причине
  // не вытеснит старый документ, зацикленные перезагрузки будут заметно хуже
  // самой протухшей версии, поэтому reload вызывается только после того, как
  // флаг записан и подтверждён: не можем гарантировать одноразовость - не лечимся.
  if (alreadyReloaded() || !rememberReload()) {
    return;
  }

  location.reload();
}

/**
 * Имя точки входа, на которую ссылается документ.
 *
 * Мост Telegram подключается обычным script без type="module", поэтому под
 * селектор попадает только бандл приложения.
 */
function bundleOf(source: Document): string | null {
  const script = source.querySelector('script[type="module"][src]');
  const src = script?.getAttribute('src');

  return src ? src.slice(src.lastIndexOf('/') + 1) : null;
}

async function publishedBundle(): Promise<string | null> {
  try {
    // cache: 'no-store' обходит HTTP-кеш в обе стороны - именно та запись,
    // из-за которой документ и оказался старым, не должна отвечать на запрос.
    const response = await fetch(new URL('index.html', document.baseURI), {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }

    // DOMParser не выполняет скрипты и не грузит ресурсы разобранного документа.
    const parsed = new DOMParser().parseFromString(
      await response.text(),
      'text/html',
    );

    return bundleOf(parsed);
  } catch {
    // Сети нет или ответ испорчен: работаем тем, что уже загружено.
    return null;
  }
}

function alreadyReloaded(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_FLAG) !== null;
  } catch {
    // Хранилище недоступно - защиты от цикла нет, значит перезагружаться нельзя.
    return true;
  }
}

/**
 * Ставит флаг перезагрузки и сообщает, действительно ли он сохранён.
 *
 * Доступность чтения ничего не говорит о доступности записи: квота и политики
 * хранения ограничивают setItem отдельно от getItem, и тогда флаг молча
 * теряется. Поэтому значение перечитывается - без подтверждённого флага
 * перезагрузка повторится при каждом открытии мини-аппа.
 */
function rememberReload(): boolean {
  try {
    sessionStorage.setItem(RELOAD_FLAG, '1');

    return sessionStorage.getItem(RELOAD_FLAG) !== null;
  } catch {
    return false;
  }
}
