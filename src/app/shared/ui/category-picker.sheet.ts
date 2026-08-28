import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { SpendingApiService } from '../../domain/api/spending-api.service';
import { Category } from '../../domain/models/models';
import { EmptyStateComponent } from './empty-state.component';
import { IconComponent } from './icon.component';
import { SwipeToCloseDirective } from '../util/swipe-to-close.directive';

export interface CategoryPickerData {
  /** Категории, уже привязанные к трате: повторно их предлагать незачем. */
  readonly excludedIds: readonly string[];
}

export type CategoryPickerResult =
  | { readonly kind: 'existing'; readonly category: Category }
  | { readonly kind: 'new'; readonly title: string };

@Component({
  selector: 'app-category-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, EmptyStateComponent, SwipeToCloseDirective],
  template: `
    <div class="sheet" appSwipeToClose (dismissed)="close()">
      <div class="sheet__grabber" aria-hidden="true"></div>

      <div class="sheet__header">
        <h2 class="sheet__title">Категория</h2>
        <button type="button" class="icon-btn" aria-label="Закрыть" (click)="close()">
          <app-icon name="close" />
        </button>
      </div>

      <div class="search">
        <app-icon class="search__icon" name="search" />
        <input
          class="field__control search__input"
          type="text"
          placeholder="Название категории"
          autocomplete="off"
          [value]="query()"
          (input)="onQuery($event)"
        />
      </div>

      <div class="sheet__body">
        @if (canCreate()) {
          <button type="button" class="panel panel--bordered create" (click)="createNew()">
            <span class="create__icon"><app-icon name="plus" /></span>
            <span class="create__text">
              Создать категорию «<b>{{ query().trim() }}</b>»
            </span>
          </button>
        }

        @if (isLoading()) {
          <div class="panel panel--bordered">
            @for (row of [1, 2, 3, 4]; track row) {
              <div class="panel__row">
                <span class="skeleton skeleton__row"></span>
              </div>
            }
          </div>
        } @else if (visible().length > 0) {
          <div class="panel panel--bordered">
            @for (category of visible(); track category.id) {
              <button type="button" class="panel__row" (click)="select(category)">
                <app-icon class="row__icon" name="tag" />
                <span class="truncate">{{ category.title }}</span>
              </button>
            }
          </div>
        } @else if (!canCreate()) {
          <app-empty-state
            icon="tag"
            [title]="query() ? 'Ничего не нашлось' : 'Свободных категорий нет'"
            hint="Начните вводить название, чтобы создать новую."
          />
        }
      </div>
    </div>
  `,
  styleUrl: './category-picker.sheet.scss',
})
export class CategoryPickerSheet {
  private readonly data = inject<CategoryPickerData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<CategoryPickerResult>>(DialogRef);
  private readonly api = inject(SpendingApiService);

  protected readonly query = signal('');
  protected readonly isLoading = signal(true);

  private readonly all = signal<readonly Category[]>([]);

  protected readonly visible = computed(() => {
    const excluded = new Set(this.data.excludedIds);
    const needle = this.query().trim().toLowerCase();

    return this.all()
      .filter((category) => !excluded.has(category.id))
      .filter((category) => !needle || category.title.toLowerCase().includes(needle));
  });

  /** Создание предлагается, только если такого названия ещё нет. */
  protected readonly canCreate = computed(() => {
    const title = this.query().trim();
    if (title === '') {
      return false;
    }

    return !this.all().some(
      (category) => category.title.toLowerCase() === title.toLowerCase(),
    );
  });

  constructor() {
    this.api.getCategories().subscribe({
      next: (categories) => {
        this.all.set(
          [...categories].sort((left, right) => left.title.localeCompare(right.title, 'ru')),
        );
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected select(category: Category): void {
    this.dialogRef.close({ kind: 'existing', category });
  }

  protected createNew(): void {
    this.dialogRef.close({ kind: 'new', title: this.query().trim() });
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
