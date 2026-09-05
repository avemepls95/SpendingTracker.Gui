import {
  Directive,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

import { MaskFormat, editMasked, skipSeparator } from '../util/mask-input.util';

/**
 * Общий каркас поля с маской и системным выбором значения.
 *
 * Поля даты и времени устроены одинаково: значение набирают в текстовом поле с
 * маской, а нативный `<input>` лежит прозрачным слоем над кнопкой и открывает
 * системный выбор. Самое хрупкое здесь - ручная синхронизация DOM с сигналом и
 * положение каретки, и в двух копиях эти места неизбежно разъезжаются, поэтому
 * они живут в одном классе.
 *
 * Наследник описывает только своё: маску, значение нативного поля, подпись
 * кнопки и разбор вставки из буфера. Разметку наследник тоже держит у себя -
 * различаются тип нативного поля и значок кнопки, - но ссылки `#control` и
 * `#native` в ней обязательны: по ним каркас находит оба поля.
 */
@Directive()
export abstract class MaskedPickerFieldBase {
  /** Значение в виде маски; пустая строка - поле не заполнено. */
  readonly value = input.required<string>();

  /** Идентификатор контрола: по нему форма связывает поле со своей подписью. */
  readonly inputId = input.required<string>();

  /** Подпись поля: уточняет, что именно выбирают. */
  readonly label = input.required<string>();

  readonly invalid = input(false);
  readonly disabled = input(false);
  readonly describedBy = input<string | null>(null);

  readonly valueChange = output<string>();

  /** Раскладка маски: по ней разбирается всё набранное в поле. */
  protected abstract readonly mask: MaskFormat;

  private readonly control = viewChild.required<ElementRef<HTMLInputElement>>('control');
  private readonly native = viewChild.required<ElementRef<HTMLInputElement>>('native');

  /**
   * Текст, стоявший в поле до последней правки.
   *
   * По нему маска отличает вставленное от стёртого: браузер сообщает только
   * итоговое содержимое, а места цифр надо разложить по сегментам.
   */
  private text = '';

  constructor() {
    // Значение переносится в DOM вручную, а не привязкой [value]: маска правит
    // набранное прямо в поле, и повторная запись той же строки привязкой
    // сбрасывала бы каретку в конец.
    effect(() => {
      const text = this.value();
      const element = this.control().nativeElement;

      if (element.value !== text) {
        element.value = text;
      }

      this.text = text;
    });
  }

  protected onInput(event: Event): void {
    const element = event.target as HTMLInputElement;
    const caret = element.selectionStart ?? element.value.length;
    const edited = editMasked(this.mask, this.text, element.value, caret);

    this.apply(edited.text, edited.caret);
  }

  protected onKeydown(event: KeyboardEvent): void {
    skipSeparator(event.target as HTMLInputElement, event.key, this.mask.separator);
  }

  /** Открывает системный выбор с кнопки - с клавиатуры или из скринридера. */
  protected openPicker(): void {
    const native = this.native().nativeElement;

    try {
      native.showPicker();
    } catch {
      // showPicker() нет в Safari на iOS и он отказывает вне жеста
      // пользователя. Фокус на нативном поле открывает выбор сам - на
      // телефоне это тот же системный выбор.
      native.focus();
    }
  }

  /** Нажатие на прозрачный слой над кнопкой. */
  protected onNativeClick(): void {
    try {
      this.native().nativeElement.showPicker();
    } catch {
      // В Safari на iOS метода нет, но там выбор уже открыт самим нажатием
      // на нативное поле - делать больше нечего.
    }
  }

  /** Пишет текст в поле, ставит каретку и сообщает форме о новом значении. */
  protected apply(text: string, caret: number): void {
    const element = this.control().nativeElement;

    element.value = text;
    element.setSelectionRange(caret, caret);

    this.text = text;

    if (text !== this.value()) {
      this.valueChange.emit(text);
    }
  }
}
