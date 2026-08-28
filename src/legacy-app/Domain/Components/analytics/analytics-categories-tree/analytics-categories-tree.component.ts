import {Component, EventEmitter, Input, OnChanges, OnInit, Output} from '@angular/core';
import {FlatTreeControl} from "@angular/cdk/tree";
import {MatTreeFlatDataSource, MatTreeFlattener} from "@angular/material/tree";
import {CategoryAnalyticsItem} from "../../../Models/Analytics/CategoryAnalyticsItem";

@Component({
  selector: 'app-analytics-categories-tree',
  templateUrl: './analytics-categories-tree.component.html',
  styleUrls: ['./analytics-categories-tree.component.scss']
})
export class AnalyticsCategoriesTreeComponent implements OnInit, OnChanges {
  @Input() categoryAnalyticsItems: CategoryAnalyticsItem[];

  @Output()
  categoryClicked = new EventEmitter();

  private _transformer = (node: CategoryAnalyticsItem, level: number) => {
    return {
      expandable: !!node.childs && node.childs.length > 0 && node.childs.filter(c => c.amount > 0.01).length > 0,
      name: node.categoryTitle,
      amount: node.amount,
      level: level,
      id: node.categoryId,
      entity: node,
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
    node => node.childs
  );

  dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);
  hasChild = (_: number, node: FlatNode) => node.expandable;

  ngOnInit(): void {
    this.dataSource.data = this.categoryAnalyticsItems;
  }

  ngOnChanges() {
    this.dataSource.data = this.categoryAnalyticsItems;
  }
}

interface FlatNode {
  id: string;
  expandable: boolean;
  name: string;
  amount: number;
  level: number;
  entity: CategoryAnalyticsItem;
}
