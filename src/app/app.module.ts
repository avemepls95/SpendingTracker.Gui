import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import {TelegramLoginWidget} from "./Common/Auth/telegram-login-widget/telegram-login-widget.component";
import {AuthComponent} from "./Common/Auth/auth.component";
import {LoaderComponent} from "./Common/Components/loader/loader.component";
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {DemoMaterialModule} from "./material-module";
import {LoaderService} from "./Common/Services/loader.service";
import {MainComponent} from "./Common/Components/main/main.component";
import { CategoriesListComponent } from './Domain/Components/categories/categories-list.component';
import {HTTP_INTERCEPTORS, HttpClientModule} from "@angular/common/http";
import {JWT_OPTIONS, JwtHelperService} from "@auth0/angular-jwt";
import {TokenInterceptor} from "./Common/Interceptors/token.interceptor";
import {ConfirmDialogComponent} from "./Common/Components/confirm-dialog/confirm-dialog.component";
import {CreateCategoryCardComponent} from "./Domain/Components/create-category-card/create-category-card.component";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import { SpendingsComponent } from './Domain/Components/spendings/spendings.component';
import { SpendingCardComponent } from './Domain/Components/spending-card/spending-card.component';
import {MaskDirective} from "./Common/Directives/mask.directive";
import {NgxMatSelectSearchModule} from "ngx-mat-select-search";
import {MatSelectModule} from "@angular/material/select";
import {MAT_DATE_LOCALE} from "@angular/material/core";
import {ResponseInterceptor} from "./Common/Interceptors/Response/response.interceptor";
import { CategoriesTreeComponent } from './Domain/Components/categories-tree/categories-tree.component';

@NgModule({
  declarations: [
    AppComponent,
    TelegramLoginWidget,
    AuthComponent,
    LoaderComponent,
    MainComponent,
    CategoriesListComponent,
    SpendingsComponent,
    ConfirmDialogComponent,
    CreateCategoryCardComponent,
    SpendingCardComponent,
    MaskDirective,
    CategoriesTreeComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    DemoMaterialModule,
    HttpClientModule,
    FormsModule,
    MatSelectModule,
    NgxMatSelectSearchModule,
    ReactiveFormsModule
  ],
  providers: [
      LoaderService,
      JwtHelperService,
      { provide: JWT_OPTIONS, useValue: JWT_OPTIONS },
      { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true },
      { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
      { provide: HTTP_INTERCEPTORS, useClass: ResponseInterceptor, multi: true },
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
