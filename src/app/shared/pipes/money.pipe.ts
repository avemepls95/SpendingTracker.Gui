import { Pipe, PipeTransform } from '@angular/core';

import { formatAmount } from '../util/money.util';

/** Сумма с разделителями разрядов. */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined, forceFraction = false): string {
    return value === null || value === undefined ? '' : formatAmount(value, forceFraction);
  }
}
