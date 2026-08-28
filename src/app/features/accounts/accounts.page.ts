import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PageHeaderComponent } from '../../shared/ui/page-header.component';

@Component({
  selector: 'app-accounts-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent],
  template: `<app-page-header title="Счета" />`,
})
export class AccountsPage {}
