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
import { normalizeGroupTitle } from '../../shared/util/tag-group.util';

export type TagGroupsResult = { readonly kind: 'changed' };

/** Ограничение сервера на название группы. */
const MAX_TITLE_LENGTH = 50;

/**
 * Начало временного названия, на которое группа уезжает при обмене названиями.
 *
 * Название видно человеку, только если пачка оборвалась ровно на этом шаге,
 * поэтому оно читаемое, а не служебное.
 */
const PARKED_TITLE_PREFIX = 'Переносится';

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
          normalizeGroupTitle(other.title) === normalizeGroupTitle(title),
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
      (row) => normalizeGroupTitle(row.title) === normalizeGroupTitle(title),
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

    requests.push(...this.buildRenameRequests());

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

  /**
   * Переименования в порядке, при котором каждое название свободно к своему
   * запросу.
   *
   * Порядка строк здесь мало: сервер отказывает в переименовании в занятое
   * название, а занять его может соседняя строка, которую ещё не успели
   * переименовать. Поэтому очередным идёт то переименование, чьё новое
   * название не держит никто из оставшихся.
   *
   * Обмен названиями («Отпуск» → «Поездка» и «Поездка» → «Отпуск») так не
   * разбирается: свободного названия нет ни у одного из двух. Такой цикл
   * разрывается временным названием - группа сначала уезжает на свободное имя,
   * освобождая своё, и доименовывается в конце. Запрещать обмен нельзя:
   * цепочка «Отпуск» → «Поездка» → «Дорога» с виду такая же, а она
   * раскладывается без ухищрений и человеку понятна.
   */
  private buildRenameRequests(): readonly Observable<unknown>[] {
    const pending = this.rows()
      .filter((row) => !row.isRemoved && row.savedTitle !== null)
      .map((row) => ({ key: row.key, from: row.savedTitle!, to: row.title.trim() }))
      .filter((rename) => rename.from !== rename.to);

    // Названия, которые до конца пачки заняты своими прежними владельцами.
    const held = new Set(pending.map((rename) => normalizeGroupTitle(rename.from)));
    const requests: Observable<unknown>[] = [];

    while (pending.length > 0) {
      const readyIndex = pending.findIndex(
        (rename) =>
          // Смена одного регистра занимает название сама у себя: сервер её
          // разрешает, и ждать освобождения тут нечего.
          normalizeGroupTitle(rename.to) === normalizeGroupTitle(rename.from) ||
          !held.has(normalizeGroupTitle(rename.to)),
      );

      if (readyIndex !== -1) {
        const [rename] = pending.splice(readyIndex, 1);
        held.delete(normalizeGroupTitle(rename.from));
        requests.push(this.renameRequest(rename.key, rename.from, rename.to));
        continue;
      }

      // Свободных названий не осталось - значит, переименования замкнуты в
      // цикл. Любое из них, уехав на временное название, разрывает цикл, а
      // остаток очереди доедет обычным порядком.
      const rename = pending.shift()!;
      const parkedTitle = this.freeTitle(held);

      held.delete(normalizeGroupTitle(rename.from));
      held.add(normalizeGroupTitle(parkedTitle));
      requests.push(this.renameRequest(rename.key, rename.from, parkedTitle));
      pending.push({ key: rename.key, from: parkedTitle, to: rename.to });
    }

    return requests;
  }

  private renameRequest(key: number, from: string, to: string): Observable<unknown> {
    return this.api.renameTagGroup(from, to).pipe(tap(() => this.commitTitle(key, to)));
  }

  /**
   * Название, которое сейчас никем не занято.
   *
   * Занятыми считаются и названия строк листа, и названия, до которых пачка
   * ещё не дошла: временная группа живёт до конца пачки и столкнуться с ними
   * не должна.
   */
  private freeTitle(held: ReadonlySet<string>): string {
    const taken = new Set(held);

    for (const row of this.rows()) {
      taken.add(normalizeGroupTitle(row.title));

      if (row.savedTitle !== null) {
        taken.add(normalizeGroupTitle(row.savedTitle));
      }
    }

    for (let index = 1; ; index++) {
      const candidate = `${PARKED_TITLE_PREFIX} ${index}`;

      if (!taken.has(normalizeGroupTitle(candidate))) {
        return candidate;
      }
    }
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
