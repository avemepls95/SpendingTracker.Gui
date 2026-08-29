# Траты по расписанию: фронтенд

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Раздел «По расписанию» внутри вкладки «Траты»: список, карточка, создание и правка, пауза, ручной запуск, предпросмотр ближайших дат.

**Architecture:** Отдельная папка `features/spending-schedules` по образцу `features/spendings`: страница-список, sheet карточки, sheet редактирования, стор на сигналах. Собственный API-сервис - существующий `spending-api.service.ts` уже обслуживает все разделы сразу. Даты расписаний приходят готовыми локальными строками и печатаются как есть: фронтенд про часовой пояс владельца не знает.

**Tech Stack:** Angular 21, standalone-компоненты, сигналы, `@angular/cdk` (Dialog, Overlay), без Angular Material, без тестового рантайма.

**Spec:** `SpendingTracker.Backend/docs/superpowers/specs/2026-08-29-scheduled-spendings-design.md`, раздел 11 - про интерфейс, раздел 10 - про контракты API.

**Предусловие:** задача 8 бэкенд-плана (`SpendingTracker.Backend/docs/superpowers/plans/2026-08-29-scheduled-spendings-backend.md`) - API должен отвечать.

## Global Constraints

- Все команды выполняются из `D:\Artem\src\SpendingTracker\SpendingTracker.Gui`.
- Angular 21 - обновлять нельзя: Node на машине `v22.14.0`, Angular 22 требует новее.
- Standalone-компоненты, `ChangeDetectionStrategy.OnPush`, состояние на сигналах.
- Все поля моделей `readonly`, коллекции - `readonly T[]`.
- Формат дат от сервера: `startDate` и `endDate` - `dd.MM.yyyy`; `startTime` - `HH:mm`; `nextOccurrenceDate`, `lastOccurrenceDate` и предпросмотр - `dd.MM.yyyy HH:mm` в локальном времени владельца.
- `null`-поля сервер из ответа выбрасывает: в DTO всё необязательное объявляется `?` и приводится маппером.
- Перечисления приходят строками.
- Тестов нет - в репозитории не заведён тестовый рантайм. Проверка каждой задачи: `npm run build` плюс сценарий в браузере.
- Комментарии - только к неочевидному. Обычное тире `-`, не длинное.

## Перед началом

```bash
cd /d/Artem/src/SpendingTracker/SpendingTracker.Gui && git checkout -b feature/scheduled-spendings
```

---

### Task 1: Модели, DTO, мапперы и API-сервис

**Files:**
- Modify: `src/app/domain/models/models.ts`
- Modify: `src/app/domain/dto/api.dto.ts`
- Modify: `src/app/domain/mappers/mappers.ts`
- Create: `src/app/domain/api/spending-schedule-api.service.ts`
- Create: `src/app/shared/util/recurrence.util.ts`

**Interfaces:**
- Consumes: существующие `Category`, `Tag`, `toCategory`, `toTag`.
- Produces: типы `RecurrenceKind`, `IntervalUnit`, `SpendingSchedule`, `SpendingScheduleDetails`, `ScheduleSpending`, `RecurrenceInput`; `SpendingScheduleApiService` с методами `getSchedules()`, `getSchedule(id)`, `createSchedule(input)`, `updateSchedule(id, input)`, `deleteSchedule(id)`, `setActive(id, isActive)`, `runNow(id)`, `previewOccurrences(rule)`; `describeRecurrence(schedule)`.

- [ ] **Step 1: Добавить модели**

В `src/app/domain/models/models.ts` после `Spending` добавить:

```ts
export const RECURRENCE_KINDS = ['Once', 'Interval'] as const;
export type RecurrenceKind = (typeof RECURRENCE_KINDS)[number];

export const INTERVAL_UNITS = ['Hour', 'Day', 'Week', 'Month', 'Year'] as const;
export type IntervalUnit = (typeof INTERVAL_UNITS)[number];

/** Правило повторения без прикладных полей: то, что принимает предпросмотр. */
export interface RecurrenceInput {
  readonly recurrenceKind: RecurrenceKind;
  readonly intervalUnit: IntervalUnit | null;
  readonly intervalValue: number;
  /** Локальная дата якоря, dd.MM.yyyy. */
  readonly startDate: string;
  /** Локальное время, HH:mm. */
  readonly startTime: string;
  readonly endDate: string | null;
}

export interface SpendingScheduleInput extends RecurrenceInput {
  readonly description: string;
  readonly amount: number;
  readonly currencyId: string;
  readonly categoryId: string | null;
  readonly tagIds: readonly string[];
}

export interface SpendingSchedule extends RecurrenceInput {
  readonly id: string;
  readonly description: string;
  readonly amount: number;
  readonly currencyId: string;
  readonly category: Category | null;
  readonly tags: readonly Tag[];
  readonly isActive: boolean;
  /** Локальная строка dd.MM.yyyy HH:mm. null - будущих срабатываний нет. */
  readonly nextOccurrenceDate: string | null;
  readonly lastOccurrenceDate: string | null;
}

/** Трата, созданная расписанием. */
export interface ScheduleSpending {
  readonly id: string;
  readonly date: string;
  readonly amount: number;
  readonly currencyId: string;
}

export interface SpendingScheduleDetails extends SpendingSchedule {
  readonly createdSpendingsCount: number;
  readonly createdSpendings: readonly ScheduleSpending[];
}

/** Расписание отработало своё: правило исчерпано, но его никто не останавливал. */
export function isScheduleFinished(schedule: SpendingSchedule): boolean {
  return schedule.isActive && schedule.nextOccurrenceDate === null;
}

export const INTERVAL_UNIT_LABELS: Record<IntervalUnit, string> = {
  Hour: 'час',
  Day: 'день',
  Week: 'неделя',
  Month: 'месяц',
  Year: 'год',
};
```

В существующий `Spending` добавить поле:

```ts
  /** Расписание, создавшее трату. null - трата заведена вручную. */
  readonly scheduleId: string | null;
```

- [ ] **Step 2: Добавить DTO**

В `src/app/domain/dto/api.dto.ts`:

```ts
export interface SpendingScheduleDto {
  readonly id: string;
  readonly description: string;
  readonly amount: number;
  readonly currencyId: string;
  readonly category?: CategoryDto | null;
  readonly tags?: readonly TagDto[] | null;
  readonly isActive: boolean;
  readonly recurrenceKind: string;
  readonly intervalUnit?: string | null;
  readonly intervalValue: number;
  readonly startDate: string;
  readonly startTime: string;
  readonly endDate?: string | null;
  readonly nextOccurrenceDate?: string | null;
  readonly lastOccurrenceDate?: string | null;
}

export interface ScheduleSpendingDto {
  readonly id: string;
  readonly date: string;
  readonly amount: number;
  readonly currencyId: string;
}

export interface SpendingScheduleDetailsDto extends SpendingScheduleDto {
  readonly createdSpendingsCount: number;
  readonly createdSpendings?: readonly ScheduleSpendingDto[] | null;
}

export interface PreviewOccurrencesDto {
  readonly occurrences?: readonly string[] | null;
}
```

В `SpendingDto` добавить `readonly scheduleId?: string | null;`.

- [ ] **Step 3: Добавить мапперы**

В `src/app/domain/mappers/mappers.ts`:

```ts
export function toSpendingSchedule(dto: SpendingScheduleDto): SpendingSchedule {
  return {
    id: dto.id,
    description: dto.description,
    amount: dto.amount,
    currencyId: dto.currencyId,
    category: dto.category ? toCategory(dto.category) : null,
    tags: (dto.tags ?? []).map(toTag),
    isActive: dto.isActive,
    recurrenceKind: dto.recurrenceKind === 'Once' ? 'Once' : 'Interval',
    intervalUnit: toIntervalUnit(dto.intervalUnit),
    intervalValue: dto.intervalValue,
    startDate: dto.startDate,
    startTime: dto.startTime,
    endDate: dto.endDate ?? null,
    nextOccurrenceDate: dto.nextOccurrenceDate ?? null,
    lastOccurrenceDate: dto.lastOccurrenceDate ?? null,
  };
}

export function toSpendingScheduleDetails(
  dto: SpendingScheduleDetailsDto,
): SpendingScheduleDetails {
  return {
    ...toSpendingSchedule(dto),
    createdSpendingsCount: dto.createdSpendingsCount,
    createdSpendings: (dto.createdSpendings ?? []).map((item) => ({
      id: item.id,
      date: item.date,
      amount: item.amount,
      currencyId: item.currencyId,
    })),
  };
}

/** Сервер шлёт перечисление строкой; None до клиента не доходит. */
function toIntervalUnit(value: string | null | undefined): IntervalUnit | null {
  const unit = INTERVAL_UNITS.find((item) => item === value);

  return unit ?? null;
}
```

В существующий `toSpending` добавить `scheduleId: dto.scheduleId ?? null,`.

- [ ] **Step 4: Написать утилиту описания периодичности**

`src/app/shared/util/recurrence.util.ts`:

```ts
import {
  INTERVAL_UNIT_LABELS,
  IntervalUnit,
  RecurrenceInput,
} from '../../domain/models/models';

const UNIT_PLURALS: Record<IntervalUnit, readonly [string, string, string]> = {
  Hour: ['час', 'часа', 'часов'],
  Day: ['день', 'дня', 'дней'],
  Week: ['неделю', 'недели', 'недель'],
  Month: ['месяц', 'месяца', 'месяцев'],
  Year: ['год', 'года', 'лет'],
};

/**
 * Человекочитаемая периодичность: «раз в месяц, 15-го, в 10:00».
 * Без неё пользователь не может проверить, что настроил то, что хотел.
 */
export function describeRecurrence(rule: RecurrenceInput): string {
  if (rule.recurrenceKind === 'Once') {
    return `Однократно ${rule.startDate} в ${rule.startTime}`;
  }

  const unit = rule.intervalUnit;
  if (!unit) {
    return 'Периодичность не задана';
  }

  const period =
    rule.intervalValue === 1
      ? `раз в ${UNIT_PLURALS[unit][0]}`
      : `раз в ${rule.intervalValue} ${plural(rule.intervalValue, UNIT_PLURALS[unit])}`;

  // Для часового интервала время в сутках не фиксировано, показывать его нечестно.
  if (unit === 'Hour') {
    return period;
  }

  const day = dayPart(rule, unit);

  return [period, day, `в ${rule.startTime}`].filter(Boolean).join(', ');
}

export function unitLabel(unit: IntervalUnit): string {
  return INTERVAL_UNIT_LABELS[unit];
}

function dayPart(rule: RecurrenceInput, unit: IntervalUnit): string {
  if (unit === 'Month') {
    return `${Number(rule.startDate.slice(0, 2))}-го`;
  }

  if (unit === 'Year') {
    return rule.startDate.slice(0, 5);
  }

  return '';
}

function plural(value: number, forms: readonly [string, string, string]): string {
  const mod100 = Math.abs(value) % 100;
  const mod10 = mod100 % 10;

  if (mod100 > 10 && mod100 < 20) {
    return forms[2];
  }

  if (mod10 === 1) {
    return forms[0];
  }

  if (mod10 >= 2 && mod10 <= 4) {
    return forms[1];
  }

  return forms[2];
}
```

- [ ] **Step 5: Написать API-сервис**

`src/app/domain/api/spending-schedule-api.service.ts`:

```ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  PreviewOccurrencesDto,
  SpendingScheduleDetailsDto,
  SpendingScheduleDto,
} from '../dto/api.dto';
import { toSpendingSchedule, toSpendingScheduleDetails } from '../mappers/mappers';
import {
  RecurrenceInput,
  SpendingSchedule,
  SpendingScheduleDetails,
  SpendingScheduleInput,
} from '../models/models';

/**
 * Обращения к API расписаний.
 *
 * Отдельно от spending-api.service: тот уже обслуживает траты, счета,
 * категории, теги, аналитику и настройки сразу.
 */
@Injectable({ providedIn: 'root' })
export class SpendingScheduleApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}spending-schedule`;

  getSchedules(): Observable<readonly SpendingSchedule[]> {
    return this.http
      .get<readonly SpendingScheduleDto[] | null>(`${this.baseUrl}/list`)
      .pipe(map((items) => (items ?? []).map(toSpendingSchedule)));
  }

  getSchedule(id: string): Observable<SpendingScheduleDetails> {
    const params = new HttpParams().set('id', id);

    return this.http
      .get<SpendingScheduleDetailsDto>(`${this.baseUrl}/get-by-id`, { params })
      .pipe(map(toSpendingScheduleDetails));
  }

  createSchedule(input: SpendingScheduleInput): Observable<string> {
    return this.http.post<string>(`${this.baseUrl}/create`, toRequest(input));
  }

  updateSchedule(id: string, input: SpendingScheduleInput): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/update`, { id, ...toRequest(input) });
  }

  deleteSchedule(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/delete`, { id });
  }

  setActive(id: string, isActive: boolean): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/set-active`, { id, isActive });
  }

  runNow(id: string): Observable<SpendingScheduleDetails> {
    return this.http
      .post<SpendingScheduleDetailsDto>(`${this.baseUrl}/run-now`, { id })
      .pipe(map(toSpendingScheduleDetails));
  }

  previewOccurrences(rule: RecurrenceInput): Observable<readonly string[]> {
    return this.http
      .post<PreviewOccurrencesDto>(`${this.baseUrl}/preview-occurrences`, {
        recurrenceKind: rule.recurrenceKind,
        intervalUnit: rule.intervalUnit,
        intervalValue: rule.intervalValue,
        startDate: rule.startDate,
        startTime: rule.startTime,
        endDate: rule.endDate,
      })
      .pipe(map((response) => response.occurrences ?? []));
  }
}

function toRequest(input: SpendingScheduleInput): Record<string, unknown> {
  return {
    description: input.description,
    amount: input.amount,
    currencyId: input.currencyId,
    categoryId: input.categoryId,
    tagIds: input.tagIds,
    recurrenceKind: input.recurrenceKind,
    intervalUnit: input.intervalUnit,
    intervalValue: input.intervalValue,
    startDate: input.startDate,
    startTime: input.startTime,
    endDate: input.endDate,
  };
}
```

Сверить `environment.apiUrl` с тем, как его использует `spending-api.service.ts` - слеш на конце должен совпадать.

- [ ] **Step 6: Собрать и закоммитить**

```bash
npm run build
git add src/app/domain src/app/shared/util/recurrence.util.ts
git commit -m "$(cat <<'EOF'
feat: модели и API расписаний

Даты расписаний приходят готовыми локальными строками: фронтенд про часовой
пояс владельца не знает, а parseCalendarDate отбрасывает время.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Стор расписаний

**Files:**
- Create: `src/app/features/spending-schedules/spending-schedules.store.ts`

**Interfaces:**
- Consumes: `SpendingScheduleApiService` (задача 1).
- Produces: `SpendingSchedulesStore` с сигналами `status`, `schedules`, `isEmpty` и методами `reload()`, `replaceLocally(schedule)`, `removeLocally(id)`, `addLocally(schedule)`.

- [ ] **Step 1: Написать стор**

```ts
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

  private generation = 0;

  readonly status = this.statusSignal.asReadonly();
  readonly schedules = computed(() => sortSchedules(this.items()));

  readonly isEmpty = computed(
    () => this.statusSignal() === 'ready' && this.items().length === 0,
  );

  reload(): void {
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

        this.statusSignal.set('error');
      },
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

    return occurrenceOrder(left.nextOccurrenceDate) - occurrenceOrder(right.nextOccurrenceDate);
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
 */
function occurrenceOrder(value: string | null): number {
  if (!value) {
    return Number.MAX_SAFE_INTEGER;
  }

  const [date, time] = value.split(' ');
  const [day, month, year] = date.split('.');

  return Number(`${year}${month}${day}${(time ?? '00:00').replace(':', '')}`);
}
```

- [ ] **Step 2: Собрать и закоммитить**

```bash
npm run build
git add src/app/features/spending-schedules
git commit -m "$(cat <<'EOF'
feat: стор расписаний

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Сегменты во вкладке «Траты» и список расписаний

**Files:**
- Create: `src/app/features/spending-schedules/spending-schedules.list.ts`
- Create: `src/app/features/spending-schedules/spending-schedules.list.html`
- Create: `src/app/features/spending-schedules/spending-schedules.list.scss`
- Modify: `src/app/features/spendings/spendings.page.ts`
- Modify: `src/app/features/spendings/spendings.page.html`
- Modify: `src/app/features/spendings/spendings.page.scss`

**Interfaces:**
- Consumes: `SpendingSchedulesStore` (задача 2), `describeRecurrence` (задача 1).
- Produces: компонент `SpendingSchedulesList` с входом-выходом через стор; на странице трат - сигнал `view: 'spendings' | 'schedules'`.

- [ ] **Step 1: Добавить переключатель на страницу трат**

Сегменты живут внутри `SpendingsPage`, переключаются **вложенные компоненты**, а не маршруты: страница объявляет `providers: [SpendingsStore]`, и смена маршрута пересоздавала бы стор - список трат с бесконечной прокруткой загружался бы с нуля при каждом возврате.

В `spendings.page.ts`:

```ts
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly view = signal<'spendings' | 'schedules'>('spendings');

  constructor() {
    this.store.reload();

    // Сегмент живёт в адресе, иначе системная кнопка «Назад» уводит из приложения
    // вместо возврата к списку трат.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.view.set(params.get('view') === 'schedules' ? 'schedules' : 'spendings');
    });
  }

  protected setView(view: 'spendings' | 'schedules'): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: view === 'schedules' ? 'schedules' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
```

Добавить в `providers` страницы `SpendingSchedulesStore`, в `imports` - `SpendingSchedulesList`.

- [ ] **Step 2: Добавить разметку сегментов**

В начало `spendings.page.html`, сразу под шапкой:

```html
<div class="segments" role="tablist" aria-label="Раздел трат">
  <button
    type="button"
    role="tab"
    class="segments__item"
    [class.segments__item--active]="view() === 'spendings'"
    [attr.aria-selected]="view() === 'spendings'"
    (click)="setView('spendings')"
  >
    Траты
  </button>
  <button
    type="button"
    role="tab"
    class="segments__item"
    [class.segments__item--active]="view() === 'schedules'"
    [attr.aria-selected]="view() === 'schedules'"
    (click)="setView('schedules')"
  >
    По расписанию
  </button>
</div>
```

Существующее содержимое страницы обернуть в `@if (view() === 'spendings') { ... }`, а рядом добавить `@else { <app-spending-schedules-list /> }`.

Стили сегментов - в `spendings.page.scss`, по образцу существующих чипов фильтра: фон `var(--surface-2)`, скруглённый контейнер, активный сегмент с фоном `var(--surface-1)` и тенью.

- [ ] **Step 3: Написать компонент списка**

`spending-schedules.list.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { SheetService } from '../../core/ui/sheet.service';
import { SpendingSchedule, isScheduleFinished } from '../../domain/models/models';
import { CurrenciesStore } from '../../domain/stores/currencies.store';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { describeRecurrence } from '../../shared/util/recurrence.util';
import { SpendingSchedulesStore } from './spending-schedules.store';

@Component({
  selector: 'app-spending-schedules-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent, IconComponent, MoneyPipe],
  templateUrl: './spending-schedules.list.html',
  styleUrl: './spending-schedules.list.scss',
})
export class SpendingSchedulesList {
  private readonly sheets = inject(SheetService);
  private readonly currencies = inject(CurrenciesStore);

  protected readonly store = inject(SpendingSchedulesStore);

  constructor() {
    this.store.reload();
  }

  protected describe(schedule: SpendingSchedule): string {
    return describeRecurrence(schedule);
  }

  protected statusLabel(schedule: SpendingSchedule): string {
    if (!schedule.isActive) {
      return 'На паузе';
    }

    if (isScheduleFinished(schedule)) {
      return 'Завершено';
    }

    return `Следующая: ${schedule.nextOccurrenceDate}`;
  }

  protected currencyCode(currencyId: string): string {
    return this.currencies.codeOf(currencyId);
  }

  protected retry(): void {
    this.store.reload();
  }
}
```

Открытие карточки и создание добавляются в задачах 4 и 5.

- [ ] **Step 4: Написать разметку списка**

`spending-schedules.list.html` - по образцу `spendings.page.html`: состояния `loading` / `error` / пусто через `EmptyStateComponent` («Пока нет расписаний. Заведите подписку или аренду, чтобы не вносить их вручную»), список карточек. Каждая карточка: описание, сумма с кодом валюты, строка периодичности, строка статуса. Для расписаний на паузе и завершённых - приглушённый цвет строки статуса.

- [ ] **Step 5: Проверить в браузере**

Поднять `npm start`, открыть вкладку «Траты», переключиться на «По расписанию», убедиться, что адрес получил `?view=schedules`, а системная кнопка «Назад» возвращает на список трат, не выходя из приложения. Проверить пустое состояние и состояние ошибки (временно погасив API).

- [ ] **Step 6: Коммит**

```bash
git add src/app/features
git commit -m "$(cat <<'EOF'
feat: раздел расписаний во вкладке трат

Сегменты переключают вложенные компоненты, а не маршруты: у страницы трат
свой стор в providers, и смена маршрута сбрасывала бы бесконечную прокрутку.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Карточка расписания

**Files:**
- Create: `src/app/features/spending-schedules/spending-schedule-details.sheet.ts`
- Create: `src/app/features/spending-schedules/spending-schedule-details.sheet.html`
- Create: `src/app/features/spending-schedules/spending-schedule-details.sheet.scss`
- Modify: `src/app/features/spending-schedules/spending-schedules.list.ts`
- Modify: `src/app/features/spending-schedules/spending-schedules.list.html`

**Interfaces:**
- Consumes: `SpendingScheduleApiService.getSchedule/setActive/runNow/deleteSchedule` (задача 1).
- Produces: `SpendingScheduleDetailsSheet`, результат `SpendingScheduleDetailsResult = { kind: 'changed'; schedule: SpendingSchedule } | { kind: 'deleted'; id: string }`.

- [ ] **Step 1: Написать компонент карточки**

Состав экрана: описание и сумма в шапке; строка периодичности (`describeRecurrence`); ближайшие даты; «Последнее срабатывание» из `lastOccurrenceDate`; переключатель «Активно»; кнопка «Создать трату сейчас»; счётчик `createdSpendingsCount` над списком последних трат; кнопка удаления с `confirmAction`.

Ключевые обработчики:

```ts
  protected toggleActive(): void {
    const schedule = this.schedule();
    if (!schedule || this.isBusy()) {
      return;
    }

    this.isBusy.set(true);

    this.api.setActive(schedule.id, !schedule.isActive).subscribe({
      next: () => this.refresh(),
      error: () => this.isBusy.set(false),
    });
  }

  protected runNow(): void {
    const schedule = this.schedule();
    if (!schedule || this.isBusy()) {
      return;
    }

    this.isBusy.set(true);

    // Ответ содержит обновлённую карточку целиком: после ручного запуска
    // надо обновить и историю, и счётчик.
    this.api.runNow(schedule.id).subscribe({
      next: (details) => {
        this.schedule.set(details);
        this.isBusy.set(false);
        this.toast.show('Трата создана');
      },
      error: () => this.isBusy.set(false),
    });
  }
```

Удаление - через `confirmAction` из `shared/ui/confirm.dialog`, как в `spending-edit.sheet`.

При закрытии карточки возвращать `{ kind: 'changed', schedule }`, чтобы список обновил строку без перезапроса.

- [ ] **Step 2: Открыть карточку из списка**

В `spending-schedules.list.ts`:

```ts
  protected openSchedule(schedule: SpendingSchedule): void {
    this.sheets
      .openSheet<SpendingScheduleDetailsResult, string>(
        SpendingScheduleDetailsSheet,
        schedule.id,
        { ariaLabel: 'Расписание траты' },
      )
      .closed.subscribe((result) => {
        if (!result) {
          return;
        }

        if (result.kind === 'deleted') {
          this.store.removeLocally(result.id);
          return;
        }

        this.store.replaceLocally(result.schedule);
      });
  }
```

- [ ] **Step 3: Проверить в браузере**

Открыть карточку, переключить «Активно» - строка статуса в списке меняется на «На паузе»; вернуть обратно - появляется новая ближайшая дата. Нажать «Создать трату сейчас» - счётчик и история растут, а на вкладке «Траты» появляется новая запись. Удалить расписание - оно исчезает из списка, а созданные им траты остаются.

- [ ] **Step 4: Коммит**

```bash
git add src/app/features/spending-schedules
git commit -m "$(cat <<'EOF'
feat: карточка расписания

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Создание и правка расписания

**Files:**
- Create: `src/app/features/spending-schedules/spending-schedule-edit.sheet.ts`
- Create: `src/app/features/spending-schedules/spending-schedule-edit.sheet.html`
- Create: `src/app/features/spending-schedules/spending-schedule-edit.sheet.scss`
- Modify: `src/app/features/spending-schedules/spending-schedules.list.ts`
- Modify: `src/app/features/spending-schedules/spending-schedule-details.sheet.ts`

**Interfaces:**
- Consumes: `SpendingScheduleApiService.createSchedule/updateSchedule/previewOccurrences`, пикеры `CurrencyPickerSheet`, `CategoryPickerSheet`, `TagPickerSheet`.
- Produces: `SpendingScheduleEditSheet`, данные `{ schedule: SpendingScheduleDetails | null }`, результат `{ kind: 'saved'; id: string }`.

- [ ] **Step 1: Написать форму**

Поля: описание, сумма, валюта (пикер), категория (пикер), теги (пикер), тип периодичности (сегменты «Однократно» / «Интервал»), число `N` и единица (селект по `INTERVAL_UNITS`), дата начала (`<input type="date">`), время (`<input type="time">`), дата окончания (`<input type="date">`, необязательная).

Даты в форме: `startDate` и `endDate` приходят как `dd.MM.yyyy`, а `<input type="date">` ждёт `yyyy-MM-dd` - использовать существующие `parseCalendarDate` и `formatInputDate` из `shared/util/date.util`, как это уже делает `spending-edit.sheet`. Обратно - собственный `toApiDate(value: string)`, который переставляет части местами.

Валидация на клиенте: описание не пустое, сумма разобралась и больше нуля, валюта выбрана, `N` от 1 до 1000 при интервальном типе. Остальное проверяет сервер.

- [ ] **Step 2: Добавить предпросмотр**

Под полями правила - блок «Ближайшие срабатывания». Запрос при изменении любого поля правила, с той же задержкой, что и поиск на странице трат (350 мс), иначе каждый удар по клавише в поле `N` уходит в сеть.

```ts
  private schedulePreview(): void {
    clearTimeout(this.previewTimer);

    this.previewTimer = setTimeout(() => {
      const rule = this.currentRule();
      if (!rule) {
        this.preview.set([]);
        return;
      }

      this.api.previewOccurrences(rule).subscribe({
        next: (occurrences) => this.preview.set(occurrences),
        // Правило без будущих срабатываний сервер отвергает - показываем пусто,
        // а текст ошибки покажет перехватчик при сохранении.
        error: () => this.preview.set([]),
      });
    }, PREVIEW_DEBOUNCE_MS);
  }
```

- [ ] **Step 3: Обработать создание тега из пикера**

`TagPickerResult` умеет `kind: 'new'`, а отключить создание нельзя - в `TagPickerData`, в отличие от `CategoryPickerData`, флага `allowCreate` нет. `createTag` идентификатор не возвращает, поэтому повторяется приём из `spending-edit.sheet`: создать тег, перечитать список тегов, найти созданный по названию и добавить его в выбранные.

В отличие от траты, разметка расписания не отправляется отдельными запросами: теги копятся в сигнале формы и уходят вместе с сохранением.

- [ ] **Step 4: Подключить форму к списку и карточке**

В списке - кнопка «+» в шапке страницы трат при активном сегменте расписаний, открывает форму с `null`. После сохранения запросить созданное расписание и добавить в стор через `addLocally`.

В карточке - кнопка «Изменить», открывает форму с текущим расписанием, после сохранения обновляет карточку.

- [ ] **Step 5: Проверить в браузере**

Сценарий целиком: создать «раз в 1 месяц, 15-го, 10:00» - предпросмотр показывает три ближайших 15-х числа; сохранить; открыть карточку; изменить на «раз в 2 месяца» - предпросмотр и карточка обновились; создать «однократно» на вчерашнюю дату - сервер отвечает ошибкой, и она видна пользователем текстом, а не «Произошла непредвиденная ошибка» (см. задачу 6); создать тег прямо из пикера - он появляется в выбранных и сохраняется вместе с расписанием.

- [ ] **Step 6: Коммит**

```bash
git add src/app/features/spending-schedules
git commit -m "$(cat <<'EOF'
feat: создание и правка расписания с предпросмотром дат

Предпросмотр считает сервер тем же калькулятором, что и планировщик:
показать даты, которых не будет, невозможно по построению.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Пометка трат по расписанию и коды ошибок

**Files:**
- Modify: `src/app/core/http/api-error.ts`
- Modify: `src/app/features/spendings/spendings.page.html`
- Modify: `src/app/features/spendings/spendings.page.scss`

**Interfaces:**
- Consumes: `Spending.scheduleId` (задача 1).
- Produces: ничего.

- [ ] **Step 1: Добавить коды ошибок**

В `describeErrorCode` добавить ветки:

```ts
    case 'SpendingScheduleDoesNotBelongsToUser':
      return 'Расписание принадлежит другому пользователю';
    case 'InvalidRecurrenceRule':
      return 'По такому правилу не будет ни одного срабатывания';
    case 'TagDoesNotBelongsToUser':
      return 'Тег принадлежит другому пользователю';
```

`TagDoesNotBelongsToUser` сервер умеет отдавать и сегодня - фронтенд его просто не знал.

- [ ] **Step 2: Пометить траты в списке**

В карточке траты на `spendings.page.html` рядом с описанием показывать значок повтора, когда `spending.scheduleId` не пуст:

```html
@if (spending.scheduleId) {
  <app-icon name="repeat" class="spending__schedule-mark" aria-label="Создана по расписанию" />
}
```

Проверить, что имя иконки существует в `icon.component.ts`; если нет - добавить путь по образцу соседних.

- [ ] **Step 3: Проверить и закоммитить**

Дождаться срабатывания расписания, убедиться, что новая трата в списке помечена значком, а заведённая через бота - нет.

```bash
npm run build
git add src/app/core src/app/features/spendings
git commit -m "$(cat <<'EOF'
feat: пометка трат по расписанию и понятные тексты новых ошибок

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Проверка перед слиянием

1. Переключение сегментов работает, адрес отражает состояние, «Назад» возвращает к тратам.
2. Создание, правка, пауза, возобновление, ручной запуск, удаление - всё отражается в списке без перезагрузки страницы.
3. Предпросмотр обновляется при изменении правила и не дёргает сеть на каждую букву.
4. Даты в карточке и в форме совпадают с тем, что показывает предпросмотр.
5. Ошибки сервера показываются текстом, а не общим «Произошла непредвиденная ошибка».
6. Тёмная и светлая темы, экран 375px: сегменты не переносятся, карточки не разъезжаются.
