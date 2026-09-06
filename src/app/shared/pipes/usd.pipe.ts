import { Pipe, PipeTransform } from '@angular/core';

/**
 * Сумма в долларах США.
 *
 * Одно обращение к модели часто стоит доли цента, и округление до двух знаков
 * сделало бы из него «$0.00» - то есть скрыло бы весь расход мелких операций.
 * Поэтому суммы меньше цента показываются с точностью до значащих цифр.
 *
 * Прочерк - у неизвестной стоимости: так помечены обращения, записанные до
 * появления тарифов.
 */
@Pipe({ name: 'usd' })
export class UsdPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '—';
    }

    if (value === 0) {
      return '$0';
    }

    if (Math.abs(value) >= 0.01) {
      return `$${value.toFixed(2)}`;
    }

    // toPrecision, а не toFixed: у суммы в стотысячные доли цента фиксированное
    // число знаков после запятой либо обнулило бы её, либо тянуло бы нули. Number
    // снимает хвостовые нули, которые toPrecision дописывает.
    return `$${Number(value.toPrecision(4))}`;
  }
}
