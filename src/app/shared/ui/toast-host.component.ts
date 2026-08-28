import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ToastService, ToastKind } from '../../core/ui/toast.service';
import { IconComponent, IconName } from './icon.component';

const ICON_BY_KIND: Record<ToastKind, IconName> = {
  error: 'alert-circle',
  success: 'check-circle',
  info: 'info',
};

@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <!--
      Контейнер живой области присутствует в разметке всегда: aria-live
      срабатывает на изменение содержимого уже существующего элемента, поэтому
      контейнер, вставленный вместе с текстом, скринридер не озвучит. А
      сообщения об ошибках сети - единственный канал, которым приложение
      рассказывает о неудавшемся запросе.
    -->
    <div class="toast-stack" role="status" aria-live="polite">
      @for (toast of toasts(); track toast.id) {
        <div class="toast" [class]="'toast--' + toast.kind">
          <app-icon class="toast__icon" [name]="iconFor(toast.kind)" />
          <span class="toast__text">{{ toast.text }}</span>
          <button
            type="button"
            class="icon-btn"
            aria-label="Закрыть уведомление"
            (click)="dismiss(toast.id)"
          >
            <app-icon name="close" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toast__icon {
      --icon-size: 20px;
    }

    .toast .icon-btn {
      width: 24px;
      height: 24px;
      margin: -2px -4px 0 0;
      --icon-size: 18px;
    }
  `,
})
export class ToastHostComponent {
  private readonly toastService = inject(ToastService);

  protected readonly toasts = this.toastService.toasts;

  protected iconFor(kind: ToastKind): IconName {
    return ICON_BY_KIND[kind];
  }

  protected dismiss(id: number): void {
    this.toastService.dismiss(id);
  }
}
