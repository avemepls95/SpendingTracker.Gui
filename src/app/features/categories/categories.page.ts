import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { SheetService } from '../../core/ui/sheet.service';
import { SpendingApiService } from '../../domain/api/spending-api.service';
import { Category, Tag } from '../../domain/models/models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import {
  CategoryRow,
  ancestorIds,
  flattenCategoryTree,
  parentCategoryIds,
} from '../../shared/util/category-tree.util';
import { TagGroup, groupTags } from '../../shared/util/tag-group.util';
import { MarkupGuideData, MarkupGuideSheet } from '../help/markup-guide.sheet';
import { MarkupDictionaryList } from '../markup/markup-dictionary.list';
import { MarkupDictionaryStore } from '../markup/markup-dictionary.store';
import {
  CategoryEditData,
  CategoryEditResult,
  CategoryEditSheet,
} from './category-edit.sheet';
import { TagEditData, TagEditResult, TagEditSheet } from './tag-edit.sheet';
import { TagGroupsResult, TagGroupsSheet } from './tag-groups.sheet';

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
  // Стор словаря объявлен на странице, а не на самом списке: список стоит под
  // @if раздела и при каждом переключении пересоздаётся. На нём стор терял бы
  // и фильтр, и догруженные страницы при всяком заходе в «Категории».
  providers: [MarkupDictionaryStore],
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
  private readonly router = inject(Router);

  protected readonly status = signal<Status>('loading');
  protected readonly mode = signal<MarkupMode>('categories');

  private readonly categories = signal<readonly Category[]>([]);
  private readonly tags = signal<readonly Tag[]>([]);

  /**
   * Названия групп, заведённых явно.
   *
   * Отдельно от тегов: группа без тегов существует только записью на сервере, и
   * по списку тегов её не восстановить.
   */
  private readonly groupTitles = signal<readonly string[]>([]);

  /** Дерево раскрывает сам человек: по умолчанию видны только корни. */
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  /** Было ли дерево уже загружено - от этого зависит судьба раскрытых веток. */
  private isLoaded = false;

  protected readonly rows = computed<readonly CategoryRow[]>(() =>
    flattenCategoryTree(this.categories(), this.expanded()),
  );

  /** Есть ли что раскрывать: у плоского списка кнопка раскрытия бессмысленна. */
  protected readonly hasBranches = computed(() =>
    this.rows().some((row) => row.hasChildren),
  );

  /**
   * Смысл кнопки «раскрыть/свернуть всё».
   *
   * Считается по текущему дереву, а не по последнему нажатию: иначе кнопка
   * залипала бы в состоянии «свернуть», когда человек уже свернул ветки руками.
   * Пока раскрыта хоть одна ветка, кнопка сворачивает - о частично раскрытом
   * дереве обычно просят «убрать лишнее», а не «раскрыть до конца».
   */
  protected readonly isAnyExpanded = computed(() =>
    this.rows().some((row) => row.isExpanded),
  );

  protected readonly tagGroups = computed<readonly TagGroup[]>(() =>
    groupTags(this.tags(), this.groupTitles()),
  );

  /** Словарь грузится сам и о состоянии этой страницы ничего не знает. */
  protected readonly isEmpty = computed(() => {
    if (this.status() !== 'ready') {
      return false;
    }

    switch (this.mode()) {
      case 'categories':
        return this.categories().length === 0;
      // Заведённая заранее группа - уже разметка: пустой список тегов с
      // единственной пустой группой показывает её, а не заглушку «тегов нет».
      case 'tags':
        return this.tags().length === 0 && this.groupTitles().length === 0;
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

  protected toggleAll(): void {
    this.expanded.set(
      this.isAnyExpanded() ? new Set() : new Set(parentCategoryIds(this.categories())),
    );
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

  /** Справка открывается на разделе, соответствующем текущему виду разметки. */
  protected openGuide(): void {
    this.sheets.openSheet<void, MarkupGuideData>(
      MarkupGuideSheet,
      { section: this.mode() === 'tags' ? 'tags' : 'basics' },
      { ariaLabel: 'Как размечать траты' },
    );
  }

  /** Создаёт категорию или тег - смотря какой раздел открыт. */
  protected create(): void {
    switch (this.mode()) {
      case 'categories':
        this.openCategorySheet({ mode: 'create' });
        return;
      case 'tags':
        this.openTagSheet({ mode: 'create' });
        return;
      // Записи словаря заводит система, запоминая решения человека. Кнопка в
      // этом разделе скрыта, но полагаться на шаблон в вопросе «что создаём»
      // нельзя: скрытая кнопка молча создавала бы тег.
      default:
        return;
    }
  }

  protected edit(category: Category): void {
    this.openCategorySheet({ mode: 'edit', category });
  }

  /**
   * Уводит на вкладку трат с готовым фильтром.
   *
   * Прежде «какие у меня траты по этой категории» приходилось спрашивать у
   * аналитики, выбирая там период; здесь период не нужен - показываются все.
   * Фильтр задаётся адресом целиком, без merge: прежние условия относятся к
   * другому вопросу и остаться не должны.
   */
  protected showCategorySpendings(category: Category): void {
    this.router.navigate(['/spendings'], { queryParams: { categoryIds: category.id } });
  }

  protected showTagSpendings(tag: Tag): void {
    this.router.navigate(['/spendings'], { queryParams: { tagIds: tag.id } });
  }

  protected editTag(tag: Tag): void {
    this.openTagSheet({ mode: 'edit', tag });
  }

  /**
   * Правка самих групп: список тегов показывает их заголовками, но
   * переименовать, удалить или завести пустую группу оттуда нечем.
   */
  protected editGroups(): void {
    this.sheets
      .openSheet<TagGroupsResult, undefined>(TagGroupsSheet, undefined, {
        ariaLabel: 'Группы тегов',
      })
      .closed.subscribe((result) => {
        if (result?.kind === 'changed') {
          this.load();
        }
      });
  }

  /**
   * Загружает оба измерения разметки разом - вместе со списком групп.
   *
   * Запросы объединены: по отдельности успешно загруженное дерево категорий
   * пряталось бы под полноэкранной ошибкой, если бы список тегов ответил
   * ошибкой с опозданием.
   *
   * Перезагружается всё сразу, даже когда правка заведомо не могла задеть часть
   * данных: группы заводятся прямо из листа правки тега, поэтому «лишним»
   * остаётся только случай правки категории. Разводить load() на варианты ради
   * одного лёгкого запроса дороже, чем сам запрос. Набор здесь фиксированный -
   * добавляя сюда новый источник, проверь, что он того же порядка стоимости.
   */
  protected load(): void {
    this.status.set('loading');

    forkJoin({
      categories: this.api.getCategories(),
      tags: this.api.getTags(),
      groups: this.api.getTagGroups(),
    }).subscribe({
      next: ({ categories, tags, groups }) => {
        const known = new Set(this.categories().map((category) => category.id));
        const isReload = this.isLoaded;

        this.categories.set(categories);
        this.tags.set(tags);
        this.groupTitles.set(groups.map((group) => group.title));

        // Раскрытие намеренно не сбрасывается: перезагрузка после правки не
        // должна схлопывать дерево и терять место, где человек работал.
        if (isReload) {
          this.revealNew(categories, known);
        }

        this.isLoaded = true;
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }

  /**
   * Раскрывает ветки до категорий, которых в прошлой загрузке не было.
   *
   * Заведя подкатегорию, человек ждёт увидеть её в дереве, а не гадать, какую
   * ветку раскрыть. Какая именно категория создана, лист правки не сообщает -
   * поэтому новые ищутся сравнением с прежним составом.
   */
  private revealNew(
    categories: readonly Category[],
    knownIds: ReadonlySet<string>,
  ): void {
    const next = new Set(this.expanded());

    for (const category of categories) {
      if (knownIds.has(category.id)) {
        continue;
      }

      for (const id of ancestorIds(category, categories)) {
        next.add(id);
      }
    }

    if (next.size !== this.expanded().size) {
      this.expanded.set(next);
    }
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
