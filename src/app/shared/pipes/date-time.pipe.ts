import { Pipe, PipeTransform } from '@angular/core';

import { formatDateTimeLabel } from '../util/date.util';

/** Момент срабатывания расписания: 28.08.2026 10:00. */
@Pipe({ name: 'dateTime' })
export class DateTimePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatDateTimeLabel(value);
  }
}
