import { Signal, WritableSignal, computed, signal } from '@angular/core';
import { Observable, concat, map, of, switchMap, tap, throwError, toArray } from 'rxjs';

import { SpendingApiService } from '../../domain/api/spending-api.service';
import { Tag } from '../../domain/models/models';

/**
 * Тег, выбранный в открытом листе.
 *
 * Идентификатора нет у тега, заведённого кнопкой «Создать»: он появится только
 * при сохранении, когда тег заведёт сервер.
 */
export interface DraftTag {
  readonly id: string | null;
  readonly title: string;
}

/** Ключ тега в списке: у нового идентификатора ещё нет, но название уникально. */
export function draftTagKey(tag: DraftTag): string {
  return tag.id ?? tag.title;
}

/**
 * Отложенный выбор тегов в листе правки.
 *
 * Держит два состояния: что выбрано на экране и что связано на сервере.
 * Разница между ними уходит запросами по кнопке «Сохранить», и каждый ушедший
 * запрос сразу переносится в серверное состояние - после сбоя посреди пачки
 * повторное сохранение не отправит то, что уже применилось.
 */
export class DraftTags {
  private saved: readonly DraftTag[];
  private readonly items: WritableSignal<readonly DraftTag[]>;

  /** Выбор для показа в листе. */
  readonly list: Signal<readonly DraftTag[]>;

  /** Уже выбранные теги: предлагать их повторно незачем. */
  readonly selectedIds: Signal<readonly string[]>;

  constructor(saved: readonly Tag[]) {
    this.saved = toDraftTags(saved);
    this.items = signal(this.saved);
    this.list = this.items.asReadonly();
    this.selectedIds = computed(() =>
      this.items()
        .map((tag) => tag.id)
        .filter((id): id is string => id !== null),
    );
  }

  addExisting(tag: Tag): void {
    this.items.update((items) => add(items, { id: tag.id, title: tag.title }));
  }

  addNew(title: string): void {
    this.items.update((items) => add(items, { id: null, title }));
  }

  remove(tag: DraftTag): void {
    const key = draftTagKey(tag);

    this.items.update((items) => items.filter((item) => draftTagKey(item) !== key));
  }

  /**
   * Запросы, приводящие связи на сервере к выбору в листе.
   *
   * Возвращается список, а не готовый поток: вызывающий ставит эти запросы в
   * общую очередь сохранения после правки самой сущности.
   */
  requests(
    api: SpendingApiService,
    link: (tagId: string, isSet: boolean) => Observable<unknown>,
  ): readonly Observable<unknown>[] {
    const current = this.items();
    const currentIds = new Set(this.selectedIds());
    const savedIds = new Set(
      this.saved.map((tag) => tag.id).filter((id): id is string => id !== null),
    );

    const requests: Observable<unknown>[] = [];

    for (const tag of this.saved) {
      if (tag.id !== null && !currentIds.has(tag.id)) {
        requests.push(
          link(tag.id, false).pipe(tap(() => this.commit(tag, false))),
        );
      }
    }

    for (const tag of current) {
      if (tag.id === null) {
        requests.push(this.createAndLink(api, tag.title, link));
        continue;
      }

      if (!savedIds.has(tag.id)) {
        requests.push(link(tag.id, true).pipe(tap(() => this.commit(tag, true))));
      }
    }

    return requests;
  }

  /**
   * Идентификаторы выбранного, с заведением новых тегов на сервере.
   *
   * Для сущностей, которые хранят связи списком внутри себя: отдельных запросов
   * на связь у них нет, а идентификатор заведённого кнопкой «Создать» тега
   * знает только сервер. Теги заводятся по одному, и каждый полученный
   * идентификатор сразу остаётся в списке - повтор после сбоя посреди пачки не
   * заведёт второй раз тот тег, который уже создан.
   */
  resolveIds(api: SpendingApiService): Observable<readonly string[]> {
    const created = this.items().filter((tag) => tag.id === null);

    if (created.length === 0) {
      return of(this.selectedIds());
    }

    return concat(...created.map((tag) => this.createTag(api, tag.title))).pipe(
      toArray(),
      map(() => this.selectedIds()),
    );
  }

  /**
   * Заводит тег на сервере.
   *
   * Идентификатор нового тега знает только сервер, поэтому список тегов
   * перечитывается. Идентификатор проставляется в списке сразу после создания,
   * до всего, что делается с тегом дальше: иначе сбой на следующем шаге увёл
   * бы повторное сохранение на второе создание того же тега.
   */
  private createTag(api: SpendingApiService, title: string): Observable<Tag> {
    return api.createTag(title).pipe(
      switchMap(() => api.getTags()),
      switchMap((tags) => {
        const created = tags.find(
          (tag) => tag.title.toLowerCase() === title.toLowerCase(),
        );

        if (!created) {
          return throwError(() => new Error(`Тег «${title}» не найден после создания`));
        }

        this.assignId({ id: created.id, title });

        return of(created);
      }),
    );
  }

  /** Заводит тег и навешивает его. */
  private createAndLink(
    api: SpendingApiService,
    title: string,
    link: (tagId: string, isSet: boolean) => Observable<unknown>,
  ): Observable<unknown> {
    return this.createTag(api, title).pipe(
      switchMap((created) =>
        link(created.id, true).pipe(
          tap(() => this.commit({ id: created.id, title }, true)),
        ),
      ),
    );
  }

  /** Переносит ушедшую на сервер связь в серверное состояние. */
  private commit(tag: DraftTag, isSet: boolean): void {
    const key = draftTagKey(tag);

    this.saved = isSet
      ? add(this.saved, tag)
      : this.saved.filter((item) => draftTagKey(item) !== key);

    this.assignId(tag);
  }

  /** У созданного тега появился идентификатор: в списке он больше не новый. */
  private assignId(tag: DraftTag): void {
    if (tag.id === null) {
      return;
    }

    this.items.update((items) =>
      items.map((item) => (item.id === null && item.title === tag.title ? tag : item)),
    );
  }
}

function toDraftTags(tags: readonly Tag[]): readonly DraftTag[] {
  return tags.map((tag) => ({ id: tag.id, title: tag.title }));
}

function add(tags: readonly DraftTag[], tag: DraftTag): readonly DraftTag[] {
  const key = draftTagKey(tag);

  return tags.some((item) => draftTagKey(item) === key) ? tags : [...tags, tag];
}
