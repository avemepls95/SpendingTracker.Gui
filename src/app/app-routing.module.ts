import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {AuthComponent} from "./Common/Auth/auth.component";
import {AuthGuard} from "./Common/Guards/auth.guard";
import {MainComponent} from "./Common/Components/main/main.component";
import {CategoriesListComponent} from "./Domain/Components/Category/categories-list/categories-list.component";
import {SpendingsComponent} from "./Domain/Components/spendings/spendings.component";

const menuRoutes: Routes = [
  { path: '', redirectTo: '/spending', pathMatch: 'full' },
  { path: 'categories', component: CategoriesListComponent },
  { path: 'spending', component: SpendingsComponent },
];

const routes: Routes = [
  {
    path: '', canActivate: [AuthGuard], children: [
      { path: '', component: MainComponent, children: menuRoutes },
    ]
  },
  { path: 'auth', component: AuthComponent },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
