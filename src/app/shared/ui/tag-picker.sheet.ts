import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { SpendingApiService } from '../../domain/api/spending-api.service';
import { Tag } from '../../domain/models/models';
import { EmptyStateComponent } from './empty-state.component';
import { IconComponent } from './icon.component';
import { SearchFieldComponent } from './search-field.component';
import { SwipeToCloseDirective } from '../util/swipe-to-close.directive';
import { TagGroup, groupTags } from '../util/tag-group.util';

export interface TagPickerData {
  /** Теги, уже навешенные на объект: повторно их предлагать незачем. */
  readonly excludedIds: readonly string[];

  /**
   * Разрешено ли заводить тег прямо из выбора. По умолчанию да.
   *
   * Выключается там, где новый тег бессмыслен, - в фильтре списка: тег без
   * трат ничего не найдёт.
   */
  readonly allowCreate?: boolean;
}

export type TagPickerResult =
  | { readonly kind: 'existing'; readonly tag: Tag }
  | { readonly kind: 'new'; readonly title: string };

/**
 * Выбор тега.
 *
 * Теги сгруппированы по назначению - место, поездка, характер расхода: в общем
 * списке «Франция» и «Вредно» стоят рядом и выглядят как один вид разметки.
 */
@Component({
  selector: 'app-tag-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, EmptyStateComponent, SearchFieldComponent, SwipeToCloseDirective],
  template: `
    <div class="sheet" appSwipeToClose (dismissed)="close()">
      <div class="sheet__grabber" aria-hidden="true"></div>

      <div class="sheet__header">
        <h2 class="sheet__title">Тег</h2>
        <button type="button" class="icon-btn" aria-label="Закрыть" (click)="close()">
          <app-icon name="close" />
        </button>
      </div>

      <app-search-field
        class="search"
        placeholder="Название тега"
        [autofocus]="true"
        [value]="query()"
        (valueChange)="onQuery($event)"
      />

      <div class="sheet__body">
        @if (canCreate()) {
          <button type="button" class="panel panel--bordered create" (click)="createNew()">
            <span class="create__icon"><app-icon name="plus" /></span>
            <span class="create__text">
              Создать тег «<b>{{ query().trim() }}</b>»
            </span>
          </button>
        }

        @if (isLoading()) {
          <div class="panel panel--bordered">
            @for (row of [1, 2, 3]; track row) {
              <div class="panel__row">
                <span class="skeleton skeleton__row"></span>
              </div>
            }
          </div>
        } @else if (groups().length > 0) {
          @for (group of groups(); track group.label) {
            <section class="tag-group">
              <h3 class="tag-group__label">{{ group.label }}</h3>
              <div class="panel panel--bordered">
                @for (tag of group.tags; track tag.id) {
                  <button type="button" class="panel__row" (click)="select(tag)">
                    <app-icon class="row__icon" name="tag" />
                    <span class="truncate">{{ tag.title }}</span>
                  </button>
                }
              </div>
            </section>
          }
        } @else if (!canCreate()) {
          <app-empty-state
            icon="tag"
            [title]="query() ? 'Ничего не нашлось' : 'Свободных тегов нет'"
            [hint]="emptyHint"
          />
        }
      </div>
    </div>
  `,
  styleUrl: './tag-picker.sheet.scss',
})
export class TagPickerSheet {
  private readonly data = inject<TagPickerData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<TagPickerResult>>(DialogRef);
  private readonly api = inject(SpendingApiService);

  /** Подсказка пустого списка обещает создание только там, где оно разрешено. */
  protected readonly emptyHint =
    this.data.allowCreate === false
      ? 'Теги заводятся в разделе разметки.'
      : 'Начните вводить название, чтобы создать новый.';

  protected readonly query = signal('');
  protected readonly isLoading = signal(true);

  private readonly all = signal<readonly Tag[]>([]);

  protected readonly groups = computed<readonly TagGroup[]>(() => {
    const excluded = new Set(this.data.excludedIds);
    const needle = this.query().trim().toLowerCase();

    const visible = this.all()
      .filter((tag) => !excluded.has(tag.id))
      .filter((tag) => !needle || tag.title.toLowerCase().includes(needle));

    return groupTags(visible);
  });

  protected readonly canCreate = computed(() => {
    if (this.data.allowCreate === false) {
      return false;
    }

    const title = this.query().trim();
    if (title === '') {
      return false;
    }

    return !this.all().some((tag) => tag.title.toLowerCase() === title.toLowerCase());
  });

  constructor() {
    this.api.getTags().subscribe({
      next: (tags) => {
        this.all.set(tags);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  protected onQuery(value: string): void {
    this.query.set(value);
  }

  protected select(tag: Tag): void {
    this.dialogRef.close({ kind: 'existing', tag });
  }

  protected createNew(): void {
    this.dialogRef.close({ kind: 'new', title: this.query().trim() });
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
