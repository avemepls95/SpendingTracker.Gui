import { Pipe, PipeTransform } from '@angular/core';

import { formatShortDate, parseCalendarDate } from '../util/date.util';

/** Дата траты в коротком виде: 28.08.26. */
@Pipe({ name: 'shortDate' })
export class ShortDatePipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    const date = parseCalendarDate(value);
    return date ? formatShortDate(date) : '';
  }
}
