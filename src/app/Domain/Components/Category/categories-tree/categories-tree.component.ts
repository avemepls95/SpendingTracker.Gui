import {Component, EventEmitter, Input, OnInit, Output, ViewEncapsulation} from '@angular/core';
import {Category} from "../../../Models/Category";
import {MatTreeFlatDataSource, MatTreeFlattener} from "@angular/material/tree";
import {FlatTreeControl} from "@angular/cdk/tree";
import {map, Observable, startWith} from "rxjs";
import {FormControl} from "@angular/forms";
import {finalize} from "rxjs/operators";
import {LoaderService} from "../../../../Common/Services/loader.service";
import {SpendingApiService} from "../../../Services/spending-api.service";

@Component({
  selector: 'app-categories-tree',
  templateUrl: './categories-tree.component.html',
  styleUrls: ['./categories-tree.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CategoriesTreeComponent implements OnInit {

  @Input() treeCategories: Category[];
  @Input() categoriesForSelect: Category[]
  @Input() spendingId: string;
  @Input() expandingStates: { [id: string]: boolean };

  @Output()
  categoriesUpdated = new EventEmitter();

  noDataMessage: string = 'Нет доступных категорий';

  newOrExistCategoryInput = new FormControl('');
  filteredCategories: Observable<Category[]>;

  constructor(
    private spendingApiService: SpendingApiService,
    private loaderService: LoaderService
  ) {
  }

  private _transformer = (node: Category, level: number) => {
    return {
      expandable: !!node.parents && node.parents.length > 0,
      name: node.title,
      level: level,
      id: node.id,
      entity: node,
      childId: ''
    };
  };

  treeControl = new FlatTreeControl<FlatNode>(
    node => node.level,
    node => node.expandable,
  );

  treeFlattener = new MatTreeFlattener(
    this._transformer,
    node => node.level,
    node => node.expandable,
    node => node.parents,
  );

  dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

  hasChild = (_: number, node: FlatNode) => node.expandable;

  ngOnInit(): void {
    if (!this.expandingStates) {
      this.expandingStates = {};
    }

    this.dataSource.data = this.treeCategories;
    this.restoreNodesExpandingStates();
    this.filteredCategories = this.newOrExistCategoryInput.valueChanges.pipe(
      startWith(''),
      map(value => this._filter(value! || '')),
    );
  }

  _filter(categoryOrCategoryTitle: any): Category[] {
    if (this.treeCategories.find(c => c.id == categoryOrCategoryTitle.id)) {
      return this.categoriesForSelect;
    }

    let allCategoryIds = this.treeControl.dataNodes.map(c => c.id);
    let isCategorySelected = !!categoryOrCategoryTitle.id;
    if (isCategorySelected){
      let result = this.categoriesForSelect.filter(c => !allCategoryIds.includes(c.id));
      return result.length != 0 ? result : [new Category({title: this.noDataMessage})];
    }

    const filterValue = categoryOrCategoryTitle.toLowerCase();

    return this.categoriesForSelect.filter(category =>
      category.title.toLowerCase().includes(filterValue)
      && !allCategoryIds.includes(category.id));
  }

  isAddingToCategoryInProcess(): boolean {
    return !!this.treeControl.dataNodes.find(n => n.id == '');
  }

  addParentNode(categoryNode: FlatNode) {
    categoryNode.entity.parents.push(new Category({
      id: '',
      title: '',
      parents: []
    }))

    this.dataSource.data = this.treeCategories;

    let node = this.treeControl.dataNodes.find(n => n.id == categoryNode.id)!;
    this.treeControl.dataNodes.find(n => n.id == '')!.childId = categoryNode.id;
    this.treeControl.expand(node);
    this.expandingStates[node.id] = true;

    this.restoreNodesExpandingStates();
  }

  addSpendingToNewCategory(newCategoryTitle: string) {
    this.loaderService.show();
    this.spendingApiService.addSpendingToNewCategory(this.spendingId, newCategoryTitle)
      .pipe(finalize(() => this.loaderService.hide()))
      .subscribe((response) => this.refreshTree());
  }

  addCategoryToExistParent(childId: string, parent: any) {
    this.loaderService.show();
    this.spendingApiService.linkParentAndChild(parent.id, childId)
      .pipe(finalize(() => this.loaderService.hide()))
      .subscribe((response) => this.refreshTree());
  }

  addCategoryToNewParent(childId: string, newParentCategoryName: string) {
    this.loaderService.show();
    this.spendingApiService.addCategoryToNewParent(childId, newParentCategoryName)
      .pipe(finalize(() => this.loaderService.hide()))
      .subscribe((response) => this.refreshTree());
  }

  addSpendingToExistCategory(selectedCategory: any) {
    this.loaderService.show();
    this.spendingApiService.linkCategoryWithSpending(this.spendingId, selectedCategory.id)
      .pipe(finalize(() => { this.loaderService.hide() }))
      .subscribe(() => this.refreshTree());
  }

  restoreNodesExpandingStates() {
    let keys = Object.keys(this.expandingStates);
    for (let i = 0; i < keys.length; i++) {
      let isExpanded = this.expandingStates[keys[i]];
      if (isExpanded) {
        this.treeControl.expand(this.treeControl.dataNodes.find(n => n.id == keys[i])!);
      }
    }
  }

  cancelAddingToParentNode(childId: string) {
    // если childId пустой, значит удаляем корневой елемент
    if (!childId) {
      let index = this.treeCategories.findIndex(c => c.id == '')!;
      this.treeCategories.splice(index, 1);
      this.dataSource.data = this.treeCategories;

      return;
    }

    let childCategory = this.treeControl.dataNodes.find(n => n.id == childId)!.entity;
    let index = childCategory.parents.findIndex(p => p.id == '')!;
    childCategory.parents.splice(index, 1);

    this.dataSource.data = this.treeCategories;
    this.restoreNodesExpandingStates();
  }

  addRootNodeCategory() {
    this.treeCategories.push(new Category({
      id: '',
      title: '',
      parents: []
    }));

    this.dataSource.data = this.treeCategories;
    this.restoreNodesExpandingStates();
  }

  refreshTree() {
    this.categoriesUpdated.emit({
      spendingId: this.spendingId,
      categoriesExpandingStates: this.expandingStates
    })
  }

  displayFn(value: any): string {
    return value ? value.title : '';
  }

  _allowSelection(option: string): { [className: string]: boolean } {
    return {
      'no-data': option === this.noDataMessage,
    }
  }

  removeSpendingFromCategory(categoryNode: FlatNode) {
    this.loaderService.show();
    this.spendingApiService.removeSpendingFromCategory(this.spendingId, categoryNode.id)
      .pipe(finalize(() => this.loaderService.hide()))
      .subscribe(() => this.refreshTree());
  }

  removeCategoryFromParent(categoryNode: FlatNode) {
    this.loaderService.show();
    let childNode = this.getChild(categoryNode)!;
    this.spendingApiService.removeCategoryFromParent(childNode.id, categoryNode.id)
      .pipe(finalize(() => { this.loaderService.hide() }))
      .subscribe(() => this.refreshTree());
  }

  getChild(node: FlatNode) {
    const {treeControl} = this;
    const currentLevel = treeControl.getLevel(node);

    if (currentLevel < 1) {
      return null;
    }

    const startIndex = treeControl.dataNodes.indexOf(node) - 1;

    for (let i = startIndex; i >= 0; i--) {
      const currentNode = treeControl.dataNodes[i];

      if (treeControl.getLevel(currentNode) < currentLevel) {
        return currentNode;
      }
    }

    return null;
  }

  addToParentCategory(categoryNode: FlatNode) {
    let selectedCategory = ((this.newOrExistCategoryInput.value as unknown) as Category);
    if (!selectedCategory.id) {
      let newCategoryName = this.newOrExistCategoryInput.value!;
      categoryNode.level == 0
        ? this.addSpendingToNewCategory(newCategoryName)
        : this.addCategoryToNewParent(categoryNode.childId, newCategoryName)

      return;
    }

    categoryNode.level == 0
      ? this.addSpendingToExistCategory(this.newOrExistCategoryInput.value!)
      : this.addCategoryToExistParent(categoryNode.childId, this.newOrExistCategoryInput.value!)
  }
}

interface FlatNode {
  id: string;
  expandable: boolean;
  name: string;
  level: number;
  entity: Category;
  childId: string;
}
