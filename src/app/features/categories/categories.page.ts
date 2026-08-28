import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { SheetService } from '../../core/ui/sheet.service';
import { SpendingApiService } from '../../domain/api/spending-api.service';
import { Category } from '../../domain/models/models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import {
  CategoryEditData,
  CategoryEditResult,
  CategoryEditSheet,
} from './category-edit.sheet';

type Status = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-categories-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, EmptyStateComponent, IconComponent],
  templateUrl: './categories.page.html',
  styleUrl: './categories.page.scss',
})
export class CategoriesPage {
  private readonly api = inject(SpendingApiService);
  private readonly sheets = inject(SheetService);

  protected readonly status = signal<Status>('loading');
  protected readonly categories = signal<readonly Category[]>([]);

  protected readonly isEmpty = computed(
    () => this.status() === 'ready' && this.categories().length === 0,
  );

  constructor() {
    this.load();
  }

  /** Прямые родители категории: показываются в строке как подпись. */
  protected parentTitles(category: Category): string {
    return category.parents.map((parent) => parent.title).join(', ');
  }

  protected create(): void {
    this.openSheet({ mode: 'create' });
  }

  protected edit(category: Category): void {
    this.openSheet({ mode: 'edit', category });
  }

  protected load(): void {
    this.status.set('loading');

    this.api.getCategories().subscribe({
      next: (categories) => {
        this.categories.set(
          [...categories].sort((left, right) =>
            left.title.localeCompare(right.title, 'ru'),
          ),
        );
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }

  private openSheet(data: CategoryEditData): void {
    this.sheets
      .openSheet<CategoryEditResult, CategoryEditData>(CategoryEditSheet, data)
      .closed.subscribe((result) => {
        if (result?.kind === 'changed') {
          this.load();
        }
      });
  }
}
