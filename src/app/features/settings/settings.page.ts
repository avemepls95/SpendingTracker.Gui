import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PageHeaderComponent } from '../../shared/ui/page-header.component';

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent],
  template: `<app-page-header title="Настройки" />`,
})
export class SettingsPage {}
