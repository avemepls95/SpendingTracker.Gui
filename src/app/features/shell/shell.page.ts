import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ScrollContainerService } from '../../core/ui/scroll-container.service';
import { CurrenciesStore } from '../../domain/stores/currencies.store';
import { UserSettingsStore } from '../../domain/stores/user-settings.store';
import { TabBarComponent } from './tab-bar.component';

/**
 * Каркас авторизованной части: прокручиваемое содержимое и панель разделов.
 *
 * Здесь же поднимаются общие справочники - они нужны почти каждому экрану,
 * а грузятся один раз за сеанс.
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, TabBarComponent],
  template: `
    <div class="shell">
      <main class="shell__content" #content>
        <router-outlet />
      </main>
      <app-tab-bar />
    </div>
  `,
  styles: `
    .shell {
      display: grid;
      // Панель разделов держится своей высотой, содержимое занимает остальное.
      grid-template-rows: 1fr auto;
      // dvh учитывает съезжающую адресную строку: на 100vh низ экрана
      // уезжал под панель браузера.
      height: 100dvh;
    }

    .shell__content {
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior-y: contain;
      -webkit-overflow-scrolling: touch;
    }
  `,
})
export class ShellPage {
  private readonly currencies = inject(CurrenciesStore);
  private readonly settings = inject(UserSettingsStore);
  private readonly scroll = inject(ScrollContainerService);

  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');

  constructor() {
    this.currencies.load();
    this.settings.load();

    afterNextRender(() => this.scroll.register(this.content().nativeElement));
    inject(DestroyRef).onDestroy(() => this.scroll.register(null));
  }
}
