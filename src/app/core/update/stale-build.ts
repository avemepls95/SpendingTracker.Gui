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
  // самой протухшей версии, поэтому флаг ставится до вызова reload.
  if (alreadyReloaded()) {
    return;
  }

  rememberReload();
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

function rememberReload(): void {
  try {
    sessionStorage.setItem(RELOAD_FLAG, '1');
  } catch {
    // Сюда не попасть: alreadyReloaded уже проверил доступность хранилища.
  }
}
