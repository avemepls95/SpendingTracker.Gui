import { Injectable, signal } from '@angular/core';

export type ToastKind = 'error' | 'success' | 'info';

export interface Toast {
  readonly id: number;
  readonly kind: ToastKind;
  readonly text: string;
}

const DURATION_MS: Record<ToastKind, number> = {
  error: 5000,
  success: 2000,
  info: 3500,
};

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly items = signal<readonly Toast[]>([]);
  private nextId = 1;

  readonly toasts = this.items.asReadonly();

  error(text: string): void {
    this.push('error', text);
  }

  success(text: string): void {
    this.push('success', text);
  }

  info(text: string): void {
    this.push('info', text);
  }

  dismiss(id: number): void {
    this.items.update((items) => items.filter((item) => item.id !== id));
  }

  private push(kind: ToastKind, text: string): void {
    // Один и тот же текст, прилетевший дважды подряд, не дублируется:
    // при пакетной ошибке экран иначе забивается одинаковыми плашками.
    if (this.items().some((item) => item.text === text)) {
      return;
    }

    const id = this.nextId++;
    this.items.update((items) => [...items, { id, kind, text }]);
    setTimeout(() => this.dismiss(id), DURATION_MS[kind]);
  }
}
