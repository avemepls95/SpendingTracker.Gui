import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { LocalStorageManager } from 'src/app/LocalStorageManager';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { LoaderService } from '../../Services/loader.service';
import {AuthService} from "../../Auth/Services/auth.service";

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})
export class MainComponent implements OnInit {
  title: string = 'Balance';
  userFirstName: string;
  avatarUrl: string;
  languagesIcons = [];

  constructor(
    private router: Router,
    private authService: AuthService,
    private loaderService: LoaderService,
    private dialog: MatDialog,
    snackbar: MatSnackBar,
    private _bottomSheet: MatBottomSheet
  ) {

    // @ts-ignore
    this.userFirstName = localStorage.getItem(LocalStorageManager.userFirstNameKey);
    let avatarTmp = localStorage.getItem(LocalStorageManager.userPhotoUrlKey);
    // @ts-ignore
    this.avatarUrl = avatarTmp ? 'assets/images/empty-avatar.png' : avatarTmp;
  }

  ngOnInit() {
  }

  refreshPage(): void {
    window.location.reload();
  }

  logout(): void {
    this.authService.removeCurrentToken();
    this.router.navigate(['/auth']);
  }
}
