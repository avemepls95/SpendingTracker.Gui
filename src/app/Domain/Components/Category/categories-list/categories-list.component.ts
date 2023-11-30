import { Component } from '@angular/core';
import {LoaderService} from "../../../../Common/Services/loader.service";
import {MatDialog} from "@angular/material/dialog";
import {finalize} from "rxjs/operators";
import {SpendingApiService} from "../../../Services/spending-api.service";
import {MatTableDataSource} from "@angular/material/table";
import {Category} from "../../../Models/Category";
import {CategoryMapper} from "../../../../Converters/CategoryMapper";
import {CreateCategoryCardComponent} from "../create-category-card/create-category-card.component";
import {
    ConfirmDialogComponent,
    ConfirmDialogModel
} from "../../../../Common/Components/confirm-dialog/confirm-dialog.component";
import {SpendingCardComponent} from "../../spending-card/spending-card.component";
import {CopyUtils} from "../../../../Common/Utils/CopyUtils";
import {Spending} from "../../../Models/Spending";
import {CategoryCardComponent} from "../category-card/category-card.component";

@Component({
  selector: 'app-categories-list',
  templateUrl: './categories-list.component.html',
  styleUrls: ['./categories-list.component.scss']
})
export class CategoriesListComponent {
    dataSource: MatTableDataSource<Category>;
    categories: Category[];

    displayedColumns: string[] = ['title', 'actions'];

    constructor(
        private spendingApiService: SpendingApiService,
        private loaderService: LoaderService,
        private dialog: MatDialog,
        private copyUtils: CopyUtils,
    ) {
      this.loadCategories();
    }

    createCategory() {
        const dialogRef = this.dialog.open(CreateCategoryCardComponent, {
            width: '370px'
        });

        dialogRef.afterClosed().subscribe(dialogResult => {
            if (!dialogResult || dialogResult.event === 'Cancel')
                return;

            this.loaderService.show();
            this.spendingApiService.createCategory(dialogResult.category.title)
                .pipe(finalize(() => { this.loaderService.hide() }))
                .subscribe(
                    () => {
                        this.loadCategories();
                    }
                );
        });
    }

    loadCategories(){
        this.loaderService.show();
        this.spendingApiService.getCategories().pipe(
            finalize(() => this.loaderService.hide())
        ).subscribe(
            (response) => {
                this.categories = response
                  .map(c => CategoryMapper.convertFromDto(c))
                  .sort((a,b) => a.title.localeCompare(b.title));
                this.dataSource = new MatTableDataSource(this.categories);
            },
            (error) => console.error(error)
        );
    }

    deleteCategory(id: string) {
        const index = this.categories.findIndex(c => c.id === id);
        if (index == -1) {
            console.log("Invalid check id:" + id);
        }

        const dialogData = new ConfirmDialogModel(
          'Подтверждение',
          'Вы уверены, что хотите удалить категорию? В этом случае все траты отвяжутся от нее');
        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
            maxWidth: "405px",
            height: "200px",
            data: dialogData
        });

        dialogRef.afterClosed().subscribe(dialogResult => {
            if (!dialogResult)
                return;

            this.loaderService.show();
            this.spendingApiService.deleteCategory(id)
                .pipe(finalize(() => {
                    this.loaderService.hide();
                }))
                .subscribe(
                    (response) => {
                        this.categories.splice(index, 1)[0];
                        this.dataSource.data = this.categories;
                    }
                );
        });
    }

  openCategoryCard(category: Category) {
    let data = {
      spending: this.copyUtils.deepCopy(category)
    }

    const dialogRef = this.dialog.open(CategoryCardComponent, {
      width: '370px',
      data: data
    });

    dialogRef.afterClosed().subscribe((result = 'Cancel') => {
      if (result != 'Cancel') {
        this.updateCategory(result.data);
      }
    });
  }

  updateCategory(category: Category) {
    this.loaderService.show();
    this.spendingApiService.updateCategory(category)
      .pipe(finalize(() => {
        this.loaderService.hide();
      }))
      .subscribe(
        (response) => {
          const index = this.categories.findIndex(p => p.id === category.id);
          if (index == -1) {
            console.log('Invalid spending id:' + category.id);
          }
          this.categories[index] = category;
          this.dataSource.data = this.categories;
        }
      );
  }
}
