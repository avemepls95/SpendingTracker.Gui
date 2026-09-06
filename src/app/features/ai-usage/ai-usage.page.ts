import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';

import {
  AiCallSiteDto,
  AiCallSiteSettingDto,
  AiUsagePeriodDto,
} from '../../domain/dto/ai-usage.dto';
import { UsdPipe } from '../../shared/pipes/usd.pipe';
import { parseAmount } from '../../shared/util/money.util';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { AiUsageStore } from './ai-usage.store';

interface PeriodOption {
  readonly value: AiUsagePeriodDto;
  readonly label: string;
}

/** Подписи исходов обращения: коды сервера человеку ничего не говорят. */
const OUTCOME_LABELS: Record<string, string> = {
  Sent: 'Ответ получен',
  Unparseable: 'Ответ не разобран',
  NoResponse: 'Ответа нет',
  NotSent: 'Не отправлено',
};

const CALL_SITE_LABELS: Record<string, string> = {
  AutoMarkup: 'Автоматическая разметка',
};

/**
 * Набранное значение не читается числом.
 *
 * Пустое поле сюда не относится: у цены это законное «не вводили».
 */
function IsUnreadable(text: string, parsed: number | null): boolean {
  return text.trim() !== '' && parsed === null;
}

/** Цена в поле ввода; пустая строка - «цену не вводили». */
function PriceText(price: number | undefined): string {
  return price === undefined ? '' : String(price);
}

/** Журнал хранит пользователя идентификатором, и отбор идёт по нему же. */
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-ai-usage-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, UsdPipe],
  providers: [AiUsageStore],
  templateUrl: './ai-usage.page.html',
  styleUrl: './ai-usage.page.scss',
})
export class AiUsagePage implements OnInit {
  protected readonly store = inject(AiUsageStore);

  protected readonly periods: readonly PeriodOption[] = [
    { value: 'Today', label: 'Сегодня' },
    { value: 'Last7Days', label: '7 дней' },
    { value: 'Last30Days', label: '30 дней' },
    { value: 'CurrentMonth', label: 'Этот месяц' },
  ];

  /** Отбор по пользователю - идентификатором: имён журнал не хранит. */
  protected readonly userFilter = signal('');

  protected readonly callSiteFilter = signal<AiCallSiteDto | ''>('');

  /** Введённый идентификатор не похож на GUID - отбор не отправляется. */
  protected readonly userFilterInvalid = signal(false);

  protected readonly model = signal('');

  /**
   * Числовые поля держат введённый текст, а не разобранное число, - как поля сумм на прочих
   * экранах. Разбор на каждом нажатии писал бы значение обратно в поле, и «0.» посреди набора
   * дробной цены обращалось бы в пустоту, не давая её дописать.
   */
  protected readonly inputPriceText = signal('');

  protected readonly outputPriceText = signal('');
  protected readonly retentionDaysText = signal('');

  /** null - поле пустое либо набранное числом не читается. */
  protected readonly inputPrice = computed(() => parseAmount(this.inputPriceText()));

  protected readonly outputPrice = computed(() => parseAmount(this.outputPriceText()));
  protected readonly retentionDays = computed(() => parseAmount(this.retentionDaysText()));

  /**
   * Отказ, о котором знает только клиент: до сервера такой запрос не доходит, и его текст
   * показать некому. Отказы сервера показывает перехватчик ошибок общей плашкой - вместе с
   * сообщением валидатора, называющим границу.
   */
  protected readonly saveError = signal<string | null>(null);

  /**
   * Наибольшая суточная сумма - масштаб столбиков ряда по дням. Ноль заменяется
   * единицей, иначе деление на него дало бы NaN на периоде без расхода.
   */
  protected readonly maxDayCost = computed(() => {
    const days = this.store.summary()?.byDay ?? [];
    const max = days.reduce((top, day) => Math.max(top, day.cost), 0);

    return max > 0 ? max : 1;
  });

  protected readonly settingsRow = computed(
    () => this.store.settings()?.callSites[0] ?? null,
  );

  /**
   * Тариф не задан хотя бы с одной стороны - обращения к вендору не уходят.
   * Строка на экране нужна потому, что меняет действие: администратор вводит цену.
   */
  protected readonly isPricingMissing = computed(() => {
    const row = this.settingsRow();

    // == null покрывает и отсутствующее поле, и явный null: сервер сейчас не сериализует
    // null, но начни он это делать - предупреждение пропало бы молча, а обращения к
    // вендору так и не пошли бы.
    return (
      row !== null &&
      (row.inputPricePerMillionTokens == null || row.outputPricePerMillionTokens == null)
    );
  });

  async ngOnInit(): Promise<void> {
    await this.store.load();
    this.fillForm();
  }

  protected outcomeLabel(outcome: string): string {
    return OUTCOME_LABELS[outcome] ?? outcome;
  }

  protected callSiteLabel(callSite: string): string {
    return CALL_SITE_LABELS[callSite] ?? callSite;
  }

  /**
   * Момент обращения в UTC: dd.MM.yyyy HH:mm.
   *
   * Показывается в UTC, а не в поясе смотрящего, потому что в UTC считаются и период, и ряд по
   * дням, и месячные лимиты разметки: момент в местном поясе не сходился бы с днём, в который
   * он попал. Общий формат подписи момента здесь не годится - он не принимает смещение,
   * которое несёт DateTimeOffset, и вернул бы строку как есть.
   */
  protected momentLabel(value: string): string {
    const moment = new Date(value);
    if (Number.isNaN(moment.getTime())) {
      return value;
    }

    const pad = (part: number) => String(part).padStart(2, '0');

    return (
      `${pad(moment.getUTCDate())}.${pad(moment.getUTCMonth() + 1)}.${moment.getUTCFullYear()} ` +
      `${pad(moment.getUTCHours())}:${pad(moment.getUTCMinutes())}`
    );
  }

  protected dayWidth(cost: number): string {
    return `${Math.round((cost / this.maxDayCost()) * 100)}%`;
  }

  /**
   * Значения полей читаются из события, а не через ngModel: приложение обходится без
   * @angular/forms - его нет ни в зависимостях, ни на других экранах.
   */
  protected onUserFilter(event: Event): void {
    this.userFilter.set((event.target as HTMLInputElement).value);
  }

  protected onCallSiteFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    this.callSiteFilter.set(value === '' ? '' : (value as AiCallSiteDto));
  }

  protected onModel(event: Event): void {
    this.model.set((event.target as HTMLInputElement).value);
  }

  protected onInputPrice(event: Event): void {
    this.inputPriceText.set((event.target as HTMLInputElement).value);
  }

  protected onOutputPrice(event: Event): void {
    this.outputPriceText.set((event.target as HTMLInputElement).value);
  }

  protected onRetentionDays(event: Event): void {
    this.retentionDaysText.set((event.target as HTMLInputElement).value);
  }

  protected setPeriod(period: AiUsagePeriodDto): void {
    this.store.setPeriod(period);
  }

  protected applyFilters(): void {
    const callSite = this.callSiteFilter();
    const userId = this.userFilter().trim();

    // Идентификатор проверяется здесь, а не на сервере: сервер на нечисловом значении
    // отвечает 400, и весь раздел - вместе с итогами и настройками, к отбору отношения не
    // имеющими, - показал бы «не удалось загрузить» вместо подсказки про одно поле.
    if (userId !== '' && !GUID_PATTERN.test(userId)) {
      this.userFilterInvalid.set(true);

      return;
    }

    this.userFilterInvalid.set(false);
    this.store.setFilters(callSite === '' ? null : callSite, userId === '' ? null : userId);
  }

  protected resetFilters(): void {
    this.callSiteFilter.set('');
    this.userFilter.set('');
    this.userFilterInvalid.set(false);
    this.store.setFilters(null, null);
  }

  protected async saveSettings(row: AiCallSiteSettingDto): Promise<void> {
    // Набранное, но нечитаемое число - это отказ, а не «цену не вводили»: пустая цена
    // закрывает гард и останавливает разметку, и получить её из опечатки нельзя.
    if (IsUnreadable(this.inputPriceText(), this.inputPrice())
        || IsUnreadable(this.outputPriceText(), this.outputPrice())) {
      this.saveError.set('Цена должна быть числом, например 15 или 0.25');

      return;
    }

    // Срок хранения на сервере - целое: пустое или дробное значение сломало бы разбор тела
    // до валидатора, и отказ вышел бы невнятным.
    const retentionDays = this.retentionDays();
    if (retentionDays === null || !Number.isInteger(retentionDays)) {
      this.saveError.set('Укажите срок хранения журнала целым числом дней');

      return;
    }

    this.saveError.set(null);

    const saved = await this.store.save({
      callSite: row.callSite,
      vendor: row.vendor,
      model: this.model().trim(),
      inputPricePerMillionTokens: this.inputPrice(),
      outputPricePerMillionTokens: this.outputPrice(),
      retentionDays,
    });

    if (saved) {
      this.fillForm();
    }
  }

  private fillForm(): void {
    const settings = this.store.settings();
    const row = settings?.callSites[0];

    if (row) {
      this.model.set(row.model);
      this.inputPriceText.set(PriceText(row.inputPricePerMillionTokens));
      this.outputPriceText.set(PriceText(row.outputPricePerMillionTokens));
    }

    if (settings) {
      this.retentionDaysText.set(String(settings.retentionDays));
    }
  }
}
