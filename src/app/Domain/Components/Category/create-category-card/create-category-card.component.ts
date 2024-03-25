import { Component, ViewChild, ElementRef } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { Category } from "../../../Models/Category";

@Component({
  selector: 'app-create-category-card',
  templateUrl: './create-category-card.component.html',
  styleUrls: ['./create-category-card.component.css']
})
export class CreateCategoryCardComponent {

  category: Category = new Category()

  constructor(private dialogRef: MatDialogRef<CreateCategoryCardComponent>) {
  }

  doAction() {
    this.dialogRef.close({ category: this.category });
  }

  closeDialog() {
    this.dialogRef.close({ event: 'Cancel' });
  }
}
