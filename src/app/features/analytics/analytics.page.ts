import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PageHeaderComponent } from '../../shared/ui/page-header.component';

@Component({
  selector: 'app-analytics-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent],
  template: `<app-page-header title="Аналитика" />`,
})
export class AnalyticsPage {}
