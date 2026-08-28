import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PageHeaderComponent } from '../../shared/ui/page-header.component';

@Component({
  selector: 'app-spendings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent],
  template: `<app-page-header title="Траты" />`,
})
export class SpendingsPage {}
