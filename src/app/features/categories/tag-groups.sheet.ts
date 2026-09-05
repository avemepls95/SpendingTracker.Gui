import { DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Observable, concat, tap } from 'rxjs';

import { TelegramService } from '../../core/telegram/telegram.service';
import { ToastService } from '../../core/ui/toast.service';
import { SpendingApiService } from '../../domain/api/spending-api.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { closeOnDismiss } from '../../shared/util/dismiss.util';
import { PluralForms, plural } from '../../shared/util/plural.util';
import { SwipeToCloseDirective } from '../../shared/util/swipe-to-close.directive';

export type TagGroupsResult = { readonly kind: 'changed' };

/** Ограничение сервера на название группы. */
const MAX_TITLE_LENGTH = 50;

const TAG_FORMS: PluralForms = ['тег', 'тега', 'тегов'];

/** Согласуется с числом тегов: «21 тег останется», а не «останутся». */
const STAY_FORMS: PluralForms = ['останется', 'останутся', 'останутся'];

type Status = 'loading' | 'ready' | 'error';

/**
 * Группа в открытом листе.
 *
 * Ключа у группы нет ни здесь, ни на сервере - она опознаётся названием,
 * поэтому строке нужен собственный номер: по нему её находят после того, как
 * название изменили.
 */
interface GroupRow {
  readonly key: number;
  /** Название, известное серверу. null - группа заведена в этом листе. */
  readonly savedTitle: string | null;
  readonly title: string;
  readonly tagCount: number;
  readonly isRemoved: boolean;
}

/**
 * Управление группами тегов: переименование, удаление и заведение пустой группы.
 *
 * Всё, что человек меняет в листе, копится в его состоянии и уходит на сервер
 * пачкой запросов по кнопке «Сохранить». Закрытие листа не применяет ничего.
 */
@Component({
  selector: 'app-tag-groups',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SwipeToCloseDirective],
  templateUrl: './tag-groups.sheet.html',
  styleUrl: './tag-groups.sheet.scss',
})
export class TagGroupsSheet {
  private readonly dialogRef = inject<DialogRef<TagGroupsResult>>(DialogRef);
  private readonly api = inject(SpendingApiService);
  private readonly telegram = inject(TelegramService);
  private readonly toast = inject(ToastService);

  /** Что уже применено на сервере: от этого зависит, перечитывать ли список тегов. */
  private hasAppliedChanges = false;

  private nextKey = 0;

  protected readonly status = signal<Status>('loading');
  protected readonly isSaving = signal(false);
  protected readonly rows = signal<readonly GroupRow[]>([]);
  protected readonly newTitle = signal('');

  protected readonly maxTitleLength = MAX_TITLE_LENGTH;

  protected readonly visibleRows = computed(() =>
    this.rows().filter((row) => !row.isRemoved),
  );

  protected readonly removedRows = computed(() =>
    this.rows().filter((row) => row.isRemoved),
  );

  /** Ошибки по строкам: сохранять можно только когда список внутренне непротиворечив. */
  protected readonly errors = computed<ReadonlyMap<number, string>>(() => {
    const visible = this.visibleRows();
    const errors = new Map<number, string>();

    for (const row of visible) {
      const title = row.title.trim();

      if (title === '') {
        errors.set(row.key, 'Укажите название');
        continue;
      }

      if (title.length > MAX_TITLE_LENGTH) {
        errors.set(row.key, `Не длиннее ${MAX_TITLE_LENGTH} символов`);
        continue;
      }

      const isDuplicate = visible.some(
        (other) =>
          other.key !== row.key &&
          other.title.trim().toLowerCase() === title.toLowerCase(),
      );

      if (isDuplicate) {
        errors.set(row.key, 'Такая группа уже есть');
      }
    }

    return errors;
  });

  protected readonly newTitleError = computed(() => {
    const title = this.newTitle().trim();
    if (title === '') {
      return null;
    }

    if (title.length > MAX_TITLE_LENGTH) {
      return `Не длиннее ${MAX_TITLE_LENGTH} символов`;
    }

    const isTaken = this.visibleRows().some(
      (row) => row.title.trim().toLowerCase() === title.toLowerCase(),
    );

    return isTaken ? 'Такая группа уже есть' : null;
  });

  protected readonly canAdd = computed(
    () => this.newTitle().trim() !== '' && this.newTitleError() === null,
  );

  protected readonly canSave = computed(
    () => !this.isSaving() && this.status() === 'ready' && this.errors().size === 0,
  );

  constructor() {
    // Пачка могла оборваться посреди сохранения, и тогда о применённой части
    // надо сообщить странице при любом способе закрытия, включая Escape.
    closeOnDismiss(this.dialogRef, () => this.close());

    this.load();
  }

  protected tagCountLabel(count: number): string {
    return count === 0 ? 'Пока без тегов' : `${count} ${plural(count, TAG_FORMS)}`;
  }

  protected removalHint(count: number): string {
    if (count === 0) {
      return 'Пустая группа';
    }

    return `${count} ${plural(count, TAG_FORMS)} ${plural(count, STAY_FORMS)} без группы`;
  }

  protected load(): void {
    this.status.set('loading');

    this.api.getTagGroups().subscribe({
      next: (groups) => {
        this.rows.set(
          groups.map((group) => ({
            key: this.nextKey++,
            savedTitle: group.title,
            title: group.title,
            tagCount: group.tagCount,
            isRemoved: false,
          })),
        );
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }

  protected onTitle(row: GroupRow, event: Event): void {
    const title = (event.target as HTMLInputElement).value;

    this.patch(row.key, (current) => ({ ...current, title }));
  }

  protected onNewTitle(event: Event): void {
    this.newTitle.set((event.target as HTMLInputElement).value);
  }

  protected add(): void {
    if (!this.canAdd()) {
      return;
    }

    const title = this.newTitle().trim();

    this.rows.update((rows) => [
      ...rows,
      { key: this.nextKey++, savedTitle: null, title, tagCount: 0, isRemoved: false },
    ]);
    this.newTitle.set('');
    this.telegram.impact('light');
  }

  /**
   * Помечает группу к удалению.
   *
   * Подтверждения нет намеренно: до «Сохранить» ничего не применяется, а
   * вернуть помеченную строку можно тут же соседней кнопкой.
   */
  protected remove(row: GroupRow): void {
    if (row.savedTitle === null) {
      // Группа заведена в этом же листе и серверу неизвестна - удалять нечего.
      this.rows.update((rows) => rows.filter((item) => item.key !== row.key));
    } else {
      this.patch(row.key, (current) => ({ ...current, isRemoved: true }));
    }

    this.telegram.impact('light');
  }

  protected restore(row: GroupRow): void {
    // Название возвращается к серверному: правка, сделанная до пометки на
    // удаление, вместе с ней и отменяется.
    this.patch(row.key, (current) => ({
      ...current,
      title: current.savedTitle ?? current.title,
      isRemoved: false,
    }));
    this.telegram.impact('light');
  }

  protected save(): void {
    if (!this.canSave()) {
      return;
    }

    const requests = this.buildRequests();

    if (requests.length === 0) {
      // Менять нечего: сообщать о сохранении, которого не было, незачем.
      this.closeWithResult();
      return;
    }

    this.isSaving.set(true);

    concat(...requests).subscribe({
      next: () => (this.hasAppliedChanges = true),
      complete: () => {
        this.telegram.notify('success');
        this.toast.success('Группы сохранены');
        this.closeWithResult();
      },
      error: (error: unknown) => this.failSave(error),
    });
  }

  protected close(): void {
    // Закрытие поверх незавершённой пачки отдало бы результат до первого
    // успешного ответа: страница не стала бы перечитывать список, а запросы
    // всё равно дошли бы до сервера.
    if (this.isSaving()) {
      return;
    }

    this.closeWithResult();
  }

  /**
   * Запросы, приводящие группы на сервере к списку в листе.
   *
   * Порядок обязателен: сначала удаления, потом переименования, потом
   * заведение новых. Сервер запрещает одноимённые группы, и освобождённое
   * название должно успеть освободиться до того, как его займут - иначе
   * «удалить „Поездка“ и переименовать „Отпуск“ в „Поездка“» упало бы на
   * половине пачки.
   *
   * Каждый ушедший запрос сразу переносится в серверное состояние строки:
   * после сбоя посреди пачки повторное сохранение не отправит то, что уже
   * применилось.
   */
  private buildRequests(): readonly Observable<unknown>[] {
    const requests: Observable<unknown>[] = [];

    for (const row of this.rows()) {
      if (row.isRemoved && row.savedTitle !== null) {
        requests.push(
          this.api
            .deleteTagGroup(row.savedTitle)
            .pipe(tap(() => this.commitRemoval(row.key))),
        );
      }
    }

    for (const row of this.rows()) {
      const title = row.title.trim();

      if (row.isRemoved || row.savedTitle === null || row.savedTitle === title) {
        continue;
      }

      requests.push(
        this.api
          .renameTagGroup(row.savedTitle, title)
          .pipe(tap(() => this.commitTitle(row.key, title))),
      );
    }

    for (const row of this.rows()) {
      if (row.isRemoved || row.savedTitle !== null) {
        continue;
      }

      const title = row.title.trim();

      requests.push(
        this.api
          .createTagGroup(title)
          .pipe(tap(() => this.commitTitle(row.key, title))),
      );
    }

    return requests;
  }

  private commitRemoval(key: number): void {
    this.rows.update((rows) => rows.filter((row) => row.key !== key));
  }

  private commitTitle(key: number, title: string): void {
    this.patch(key, (current) => ({ ...current, savedTitle: title, title }));
  }

  private patch(key: number, update: (row: GroupRow) => GroupRow): void {
    this.rows.update((rows) => rows.map((row) => (row.key === key ? update(row) : row)));
  }

  private closeWithResult(): void {
    this.dialogRef.close(this.hasAppliedChanges ? { kind: 'changed' } : undefined);
  }

  /**
   * Оставляет лист открытым после сбоя.
   *
   * Состояние не теряется, а часть запросов могла примениться: страница
   * перечитает список при закрытии. Об отказе сервера сообщает перехватчик,
   * плашка нужна только собственным ошибкам сохранения.
   */
  private failSave(error: unknown): void {
    this.isSaving.set(false);

    if (!(error instanceof HttpErrorResponse)) {
      this.toast.error('Не удалось сохранить изменения');
    }
  }
}
