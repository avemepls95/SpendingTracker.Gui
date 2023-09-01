import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { LoaderService } from '../../Services/loader.service';
import {ThemePalette} from "@angular/material/core";
import {ProgressSpinnerMode} from "@angular/material/progress-spinner";

@Component({
  selector: 'app-loader',
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.css']
})
export class LoaderComponent implements OnInit {

  color: ThemePalette = 'primary';
  mode: ProgressSpinnerMode = 'indeterminate';
  value = 50;
  isLoading: Boolean = false;

  constructor(private loaderService: LoaderService, private cdRef: ChangeDetectorRef) {
    this.loaderService.isLoading.subscribe(x => {
      this.isLoading = x;
      this.cdRef.detectChanges()
    });
   }

  ngOnInit() {
  }
}
