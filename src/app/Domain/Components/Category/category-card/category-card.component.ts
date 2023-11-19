import {Component, Inject, OnDestroy, OnInit, Optional, ViewChild} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {Subject} from "rxjs";
import {Category} from "../../../Models/Category";

@Component({
  selector: 'app-spending-card',
  templateUrl: './category-card.component.html',
  styleUrls: ['./category-card.component.scss']
})
export class CategoryCardComponent implements OnInit, OnDestroy {
  category: Category;

  selectedCurrencyId: string;

  protected _onDestroy = new Subject<void>();

  constructor(
    public dialogRef: MatDialogRef<CategoryCardComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: any,
  ) {
    this.category = new Category(data.spending);
  }

  ngOnInit() {
  }

  ngOnDestroy() {
    this._onDestroy.next();
    this._onDestroy.complete();
  }

  save() {
    this.dialogRef.close({ data: this.category });
  }

  closeDialog() {
    this.dialogRef.close('Cancel');
  }

  canBeCreated(): boolean {
    return this.category.title != null
      && this.category.title != '';
  }
}
