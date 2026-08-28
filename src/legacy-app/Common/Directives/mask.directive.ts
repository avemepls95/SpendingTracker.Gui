import { Directive, ElementRef, Input, HostListener } from '@angular/core';

@Directive({
  selector: '[Mask]'
})
export class MaskDirective {

  constructor(private el: ElementRef) { }

  @Input() Mask: string;

  private specialKeys: Array<string> = ['Backspace', 'Tab', 'End', 'Home', 'ArrowLeft', 'ArrowRight', 'Del', 'Delete'];

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (!this.Mask) {
      return;
    }

    if (this.specialKeys.indexOf(event.key) !== -1) {
      return;
    }
    
    let current: string = this.el.nativeElement.value;
    const position = this.el.nativeElement.selectionStart;
    const next: string = [current.slice(0, position), event.key == 'Decimal' ? '.' : event.key, current.slice(position)].join('');
    if (next && !String(next).match(new RegExp(this.Mask))) {
      event.preventDefault();
    }
  }
}
