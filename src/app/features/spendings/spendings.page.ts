import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { SheetService } from '../../core/ui/sheet.service';
import { Spending } from '../../domain/models/models';
import { CurrenciesStore } from '../../domain/stores/currencies.store';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { IntersectDirective } from '../../shared/util/intersect.directive';
import { SpendingSchedulesList } from '../spending-schedules/spending-schedules.list';
import { SpendingSchedulesStore } from '../spending-schedules/spending-schedules.store';
import {
  SpendingEditResult,
  SpendingEditSheet,
} from './spending-edit.sheet';
import { SpendingsStore } from './spendings.store';

/** Пауза перед запросом, чтобы не дёргать сервер на каждую букву. */
const SEARCH_DEBOUNCE_MS = 350;

/** Разделы вкладки: собственный список трат и расписания. */
export type SpendingsView = 'spendings' | 'schedules';

@Component({
  selector: 'app-spendings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SpendingsStore, SpendingSchedulesStore],
  imports: [
    PageHeaderComponent,
    EmptyStateComponent,
    IconComponent,
    IntersectDirective,
    MoneyPipe,
    SpendingSchedulesList,
  ],
  templateUrl: './spendings.page.html',
  styleUrl: './spendings.page.scss',
})
export class SpendingsPage implements OnDestroy {
  private readonly sheets = inject(SheetService);
  private readonly currencies = inject(CurrenciesStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly store = inject(SpendingsStore);
  protected readonly isSearchOpen = signal(false);
  protected readonly view = signal<SpendingsView>('spendings');

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly searchInput =
    viewChild<ElementRef<HTMLInputElement>>('searchInput');

  constructor() {
    this.store.reload();

    // Сегмент живёт в адресе, иначе системная кнопка «Назад» уводит из
    // приложения вместо возврата к списку трат.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.view.set(params.get('view') === 'schedules' ? 'schedules' : 'spendings');
    });

    // Атрибут autofocus действует только на элементы, присутствующие при
    // разборе документа; поле поиска появляется по нажатию, поэтому фокус
    // ставится вручную, как только элемент отрисован.
    effect(() => {
      if (this.isSearchOpen()) {
        this.searchInput()?.nativeElement.focus();
      }
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
  }

  /**
   * Переключает раздел через адрес.
   *
   * Запись в историю намеренная, replaceUrl тут не годится: без неё «Назад»
   * закрыл бы приложение вместо возврата к предыдущему разделу.
   */
  protected setView(view: SpendingsView): void {
    if (view === this.view()) {
      return;
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: view === 'schedules' ? 'schedules' : null },
      queryParamsHandling: 'merge',
    });
  }

  protected toggleSearch(): void {
    const willOpen = !this.isSearchOpen();
    this.isSearchOpen.set(willOpen);

    if (!willOpen) {
      clearTimeout(this.searchTimer);
      this.store.setSearch('');
    }
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;

    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(
      () => this.store.setSearch(value),
      SEARCH_DEBOUNCE_MS,
    );
  }

  /**
   * Фильтр переключается по (change), а не по (click).
   *
   * Прежний чекбокс вызывал перезагрузку из обработчика клика, то есть до того,
   * как ngModel успевал получить новое значение, и фильтр применялся со старым.
   */
  protected setOnlyWithoutCategories(value: boolean): void {
    this.store.setOnlyWithoutCategories(value);
  }

  protected currencyCode(currencyId: string): string {
    return this.currencies.codeOf(currencyId);
  }

  protected openSpending(spending: Spending): void {
    this.sheets
      .openSheet<SpendingEditResult, Spending>(SpendingEditSheet, spending, {
        ariaLabel: 'Редактирование траты',
      })
      .closed.subscribe((result) => {
        if (!result) {
          return;
        }

        if (result.kind === 'deleted') {
          this.store.removeLocally(result.id);
          return;
        }

        this.store.replaceLocally(result.spending);
      });
  }

  protected retry(): void {
    this.store.reload();
  }

  protected loadMore(): void {
    this.store.loadMore();
  }
}
