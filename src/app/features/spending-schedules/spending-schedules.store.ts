import { Injectable, computed, inject, signal } from '@angular/core';

import { SpendingScheduleApiService } from '../../domain/api/spending-schedule-api.service';
import { SpendingSchedule, isScheduleFinished } from '../../domain/models/models';

export type ListStatus = 'loading' | 'ready' | 'error';

/**
 * Список расписаний.
 *
 * Пагинации нет - расписаний у пользователя единицы. Порядок задаёт сервер,
 * но локальные правки не должны его ломать, поэтому сортировка повторена здесь.
 */
@Injectable()
export class SpendingSchedulesStore {
  private readonly api = inject(SpendingScheduleApiService);

  private readonly items = signal<readonly SpendingSchedule[]>([]);
  private readonly statusSignal = signal<ListStatus>('loading');

  /**
   * Номер поколения запроса: ответ на отменённую загрузку не должен
   * перетирать актуальный список.
   */
  private generation = 0;

  /** Запрос уже отправлен: повторно грузить список при возврате незачем. */
  private requested = false;

  readonly status = this.statusSignal.asReadonly();
  readonly schedules = computed(() => sortSchedules(this.items()));

  readonly isEmpty = computed(
    () => this.statusSignal() === 'ready' && this.items().length === 0,
  );

  /**
   * Загружает список, если готовых данных ещё нет.
   *
   * Компонент списка живёт под @if сегмента и пересоздаётся при каждом
   * переключении, а стор объявлен на уровне страницы и переключение переживает.
   * Безусловная перезагрузка прятала бы загруженный список за скелетоном.
   */
  ensureLoaded(): void {
    if (!this.requested) {
      this.reload();
    }
  }

  reload(): void {
    this.requested = true;
    this.statusSignal.set('loading');

    const generation = ++this.generation;

    this.api.getSchedules().subscribe({
      next: (schedules) => {
        if (generation !== this.generation) {
          return;
        }

        this.items.set(schedules);
        this.statusSignal.set('ready');
      },
      error: () => {
        if (generation !== this.generation) {
          return;
        }

        // Снимаем отметку запроса, чтобы возврат на сегмент попробовал снова,
        // а не показывал ошибку до перезагрузки страницы.
        this.requested = false;
        this.statusSignal.set('error');
      },
    });
  }

  /**
   * Подтягивает расписание по идентификатору и вставляет его в список.
   *
   * Создание возвращает только идентификатор: остальные поля - разобранное
   * правило, ближайшая дата - считает сервер.
   */
  addById(id: string): void {
    this.api.getSchedule(id).subscribe({
      next: (schedule) => this.addLocally(schedule),
    });
  }

  addLocally(schedule: SpendingSchedule): void {
    this.items.update((current) => [...current, schedule]);
  }

  replaceLocally(schedule: SpendingSchedule): void {
    this.items.update((current) =>
      current.map((item) => (item.id === schedule.id ? schedule : item)),
    );
  }

  removeLocally(id: string): void {
    this.items.update((current) => current.filter((item) => item.id !== id));
  }
}

/** Сначала работающие по ближайшей дате, затем на паузе, затем завершённые. */
function sortSchedules(
  schedules: readonly SpendingSchedule[],
): readonly SpendingSchedule[] {
  return [...schedules].sort((left, right) => {
    const rankDiff = rank(left) - rank(right);
    if (rankDiff !== 0) {
      return rankDiff;
    }

    const occurrenceDiff =
      occurrenceOrder(left.nextOccurrenceDate) - occurrenceOrder(right.nextOccurrenceDate);
    if (occurrenceDiff !== 0) {
      return occurrenceDiff;
    }

    // Третий ключ повторяет серверный: у всех записей на паузе и у завершённых
    // указателя нет, то есть по первым двум ключам они равны между собой.
    return left.description.localeCompare(right.description, 'ru');
  });
}

function rank(schedule: SpendingSchedule): number {
  if (!schedule.isActive) {
    return 1;
  }

  return isScheduleFinished(schedule) ? 2 : 0;
}

/**
 * Дата приходит строкой dd.MM.yyyy HH:mm, поэтому сравнивать её как текст нельзя:
 * «01.12.2026» оказалось бы раньше «02.01.2026». Переставляем части в число.
 *
 * Результат не длиннее 12 знаков даже для 9999 года, поэтому с MAX_SAFE_INTEGER
 * он не пересекается: сентинел остаётся строго больше любой реальной даты.
 */
function occurrenceOrder(value: string | null): number {
  if (!value) {
    return Number.MAX_SAFE_INTEGER;
  }

  const [date, time] = value.split(' ');
  const [day, month, year] = date.split('.');
  const order = Number(`${year}${month}${day}${(time ?? '00:00').replace(':', '')}`);

  // NaN в компараторе приводится к нулю и делает его нетранзитивным, то есть
  // одна неразобранная строка перемешала бы порядок соседних записей.
  return Number.isNaN(order) ? Number.MAX_SAFE_INTEGER : order;
}
