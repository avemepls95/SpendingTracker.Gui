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
import { CategoriesComponent } from './Domain/Components/categories/categories.component';
import {HTTP_INTERCEPTORS, HttpClientModule} from "@angular/common/http";
import {JWT_OPTIONS, JwtHelperService} from "@auth0/angular-jwt";
import {TokenInterceptor} from "./Common/Interceptors/token.interceptor";
import {ConfirmDialogComponent} from "./Common/Components/confirm-dialog/confirm-dialog.component";
import {CreateCategoryCardComponent} from "./Domain/Components/create-category-card/create-category-card.component";
import {FormsModule} from "@angular/forms";

@NgModule({
  declarations: [
    AppComponent,
    TelegramLoginWidget,
    AuthComponent,
    LoaderComponent,
    MainComponent,
    CategoriesComponent,
    ConfirmDialogComponent,
    CreateCategoryCardComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    DemoMaterialModule,
    HttpClientModule,
    FormsModule
  ],
  providers: [
      LoaderService,
      JwtHelperService,
      { provide: JWT_OPTIONS, useValue: JWT_OPTIONS },
      { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true },
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
