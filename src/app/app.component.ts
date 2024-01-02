import { Component } from '@angular/core';
import {UserSettingsStore} from "./Domain/Store/UserSettingsStore";
import {CurrenciesStore} from "./Domain/Store/CurrenciesStore";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  constructor(
    userSettingsStore: UserSettingsStore,
    currenciesStore: CurrenciesStore
  ) {
    userSettingsStore.initialize();
    currenciesStore.initialize();
  }
}
