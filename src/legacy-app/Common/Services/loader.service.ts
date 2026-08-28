import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable()
export class LoaderService {

  isLoading = new Subject<boolean>();
  loadingIncrement: number = 0;

  constructor(){
  }

  show() {
    this.isLoading.next(true);
    this.loadingIncrement++;
  }

  hide() {
    this.loadingIncrement--;
    if (this.loadingIncrement < 1) {
      this.isLoading.next(false);
    }
  }
}
