import { Component } from '@angular/core';
import {LoaderService} from "../../../Common/Services/loader.service";
import {MatDialog} from "@angular/material/dialog";
import {finalize} from "rxjs/operators";
import {SpendingApiService} from "../../Services/spending-api.service";
import {MatTableDataSource} from "@angular/material/table";
import {Category} from "../../Models/Category";
import {CategoryMapper} from "../../../Converters/CategoryMapper";
import {CreateCategoryCardComponent} from "../create-category-card/create-category-card.component";
import {
    ConfirmDialogComponent,
    ConfirmDialogModel
} from "../../../Common/Components/confirm-dialog/confirm-dialog.component";

@Component({
  selector: 'app-categories',
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
                this.categories = response.map(c => CategoryMapper.convertFromDto(c));
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

        const dialogData = new ConfirmDialogModel('Подтверждение', 'Вы уверены, что хотите удалить категорию?');
        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
            maxWidth: "420px",
            height: "160px",
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
}
