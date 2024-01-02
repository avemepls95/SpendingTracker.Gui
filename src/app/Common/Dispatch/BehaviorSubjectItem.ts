import {BehaviorSubject, Observable} from "rxjs";

export class BehaviorSubjectItem<T> {
  readonly subject: BehaviorSubject<T>;
  readonly value$: Observable<T>;

  get value(): T {
    return this.subject.value;
  }

  set value(value: T) {
    this.subject.next(value);
  }

  constructor(initialValue: T) {
    this.subject = new BehaviorSubject(initialValue);
    this.value$ = this.subject.asObservable();
  }
}
