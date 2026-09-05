import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { reloadIfStaleBuild } from './app/core/update/stale-build';
import { environment } from './environments/environment';

// Проверка идёт параллельно загрузке приложения, а не после неё: старт не
// должен ждать сеть, а чем раньше протухший документ будет заменён, тем меньше
// пользователь успеет сделать в старой версии.
if (environment.production) {
  void reloadIfStaleBuild();
}

bootstrapApplication(AppComponent, appConfig).catch((error: unknown) =>
  console.error(error),
);
