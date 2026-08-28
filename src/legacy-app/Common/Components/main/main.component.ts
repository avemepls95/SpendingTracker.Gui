import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { LocalStorageManager } from 'src/app/LocalStorageManager';
import {AuthService} from "../../Auth/Services/auth.service";
import {MenuItem} from "./MenuItem";
import {UserSettingsStore} from "../../../Domain/Store/UserSettingsStore";
import {CurrenciesStore} from "../../../Domain/Store/CurrenciesStore";
import {AccountTypeToViewInfoMapping} from "../../../Domain/Models/Accounts/AccountTypeEnum";

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit {
  title: string = 'Balance';
  userFirstName: string;
  currentPageTitle: string;
  avatarUrl: string;
  isFromTelegramWebApp: string;
  menuItems: MenuItem[] = [
    { route: '/spending', text: 'Траты', iconUrl: 'assets/images/menu-spendings-30.png', withDivider: false },
    { route: '/accounts', text: 'Счета', iconUrl: 'assets/images/menu-bills-30.png', withDivider: false },
    { route: '/categories-list', text: 'Мои категории', iconUrl: 'assets/images/menu-categories-30.png', withDivider: false },
    { route: '/analytics', text: 'Аналитика', iconUrl: 'assets/images/menu-analytics-30.png', withDivider: true },
    { route: '/settings', text: 'Настройки', iconUrl: 'assets/images/menu-settings-30.png', withDivider: false },
  ]

  constructor(
    private router: Router,
    private authService: AuthService,
    userSettingsStore: UserSettingsStore,
    currenciesStore: CurrenciesStore
  ) {
    userSettingsStore.initialize();
    currenciesStore.initialize();

    this.userFirstName = localStorage.getItem(LocalStorageManager.userFirstNameKey)!;
    let avatarTmp = localStorage.getItem(LocalStorageManager.userPhotoUrlKey)!;
    this.avatarUrl = avatarTmp ? avatarTmp : 'assets/images/empty-avatar.png';

    this.isFromTelegramWebApp = localStorage.getItem(LocalStorageManager.isFromTelegramWebApp)!;
  }

  ngOnInit() {
    this.currentPageTitle = this.menuItems.find(i => i.route == this.router.url)!.text;
  }

  refreshPage(): void {
    window.location.reload();
  }

  logout(): void {
    this.authService.removeCurrentToken();
    this.router.navigate(['/auth']);
  }

  protected readonly AccountTypeToViewInfoMapping = AccountTypeToViewInfoMapping;
}
