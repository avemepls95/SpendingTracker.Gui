import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { SheetService } from '../../core/ui/sheet.service';
import { SpendingApiService } from '../../domain/api/spending-api.service';
import { Category, Tag } from '../../domain/models/models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import {
  CategoryRow,
  flattenCategoryTree,
  parentCategoryIds,
} from '../../shared/util/category-tree.util';
import { TagGroup, groupTags } from '../../shared/util/tag-group.util';
import { MarkupDictionaryList } from '../markup/markup-dictionary.list';
import {
  CategoryEditData,
  CategoryEditResult,
  CategoryEditSheet,
} from './category-edit.sheet';
import { TagEditData, TagEditResult, TagEditSheet } from './tag-edit.sheet';

type Status = 'loading' | 'ready' | 'error';

/**
 * Разделы вкладки.
 *
 * Категории и теги - два измерения разметки, словарь - то, что система про
 * разметку запомнила. Они не смешиваются в одном списке.
 */
export type MarkupMode = 'categories' | 'tags' | 'dictionary';

@Component({
  selector: 'app-categories-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    EmptyStateComponent,
    IconComponent,
    MarkupDictionaryList,
  ],
  templateUrl: './categories.page.html',
  styleUrl: './categories.page.scss',
})
export class CategoriesPage {
  private readonly api = inject(SpendingApiService);
  private readonly sheets = inject(SheetService);

  protected readonly status = signal<Status>('loading');
  protected readonly mode = signal<MarkupMode>('categories');

  private readonly categories = signal<readonly Category[]>([]);
  private readonly tags = signal<readonly Tag[]>([]);
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  protected readonly rows = computed<readonly CategoryRow[]>(() =>
    flattenCategoryTree(this.categories(), this.expanded()),
  );

  protected readonly tagGroups = computed<readonly TagGroup[]>(() =>
    groupTags(this.tags()),
  );

  /** Словарь грузится сам и о состоянии этой страницы ничего не знает. */
  protected readonly isEmpty = computed(() => {
    if (this.status() !== 'ready') {
      return false;
    }

    switch (this.mode()) {
      case 'categories':
        return this.categories().length === 0;
      case 'tags':
        return this.tags().length === 0;
      default:
        return false;
    }
  });

  constructor() {
    this.load();
  }

  protected setMode(mode: MarkupMode): void {
    this.mode.set(mode);
  }

  protected toggle(row: CategoryRow): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      if (!next.delete(row.category.id)) {
        next.add(row.category.id);
      }

      return next;
    });
  }

  /**
   * Создаёт категорию или тег - смотря какой раздел открыт.
   *
   * В словаре создавать нечего: его записи заводит система, запоминая решения
   * человека, поэтому кнопка там не показывается.
   */
  protected create(): void {
    if (this.mode() === 'categories') {
      this.openCategorySheet({ mode: 'create' });
      return;
    }

    this.openTagSheet({ mode: 'create' });
  }

  protected edit(category: Category): void {
    this.openCategorySheet({ mode: 'edit', category });
  }

  protected editTag(tag: Tag): void {
    this.openTagSheet({ mode: 'edit', tag });
  }

  /**
   * Загружает оба измерения разметки разом.
   *
   * Запросы объединены: по отдельности успешно загруженное дерево категорий
   * пряталось бы под полноэкранной ошибкой, если бы список тегов ответил
   * ошибкой с опозданием.
   */
  protected load(): void {
    this.status.set('loading');

    forkJoin({
      categories: this.api.getCategories(),
      tags: this.api.getTags(),
    }).subscribe({
      next: ({ categories, tags }) => {
        this.categories.set(categories);
        this.tags.set(tags);

        // Ветки раскрыты по умолчанию: свёрнутое дерево показывает три строки
        // и выглядит так, будто категорий почти нет.
        this.expanded.set(new Set(parentCategoryIds(categories)));
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }

  private openCategorySheet(data: CategoryEditData): void {
    this.sheets
      .openSheet<CategoryEditResult, CategoryEditData>(CategoryEditSheet, data, {
        ariaLabel:
          data.mode === 'create' ? 'Новая категория' : 'Редактирование категории',
      })
      .closed.subscribe((result) => {
        if (result?.kind === 'changed') {
          this.load();
        }
      });
  }

  private openTagSheet(data: TagEditData): void {
    this.sheets
      .openSheet<TagEditResult, TagEditData>(TagEditSheet, data, {
        ariaLabel: data.mode === 'create' ? 'Новый тег' : 'Редактирование тега',
      })
      .closed.subscribe((result) => {
        if (result?.kind === 'changed') {
          this.load();
        }
      });
  }
}
