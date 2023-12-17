import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { LocalStorageManager } from 'src/app/LocalStorageManager';
import {AuthService} from "../../Auth/Services/auth.service";
import {MenuItem} from "./MenuItem";

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
    { route: '/spending', text: 'Траты', icon: 'money_off' },
    { route: '/categories-list', text: 'Мои категории', icon: 'folder_shared' },
    { route: '/analytics', text: 'Аналитика', icon: 'show_chart' },
  ]

  constructor(
    private router: Router,
    private authService: AuthService,
  ) {
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
}
