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
import {HttpClientModule} from "@angular/common/http";

@NgModule({
  declarations: [
    AppComponent,
    TelegramLoginWidget,
    AuthComponent,
    LoaderComponent,
    MainComponent,
    CategoriesComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    DemoMaterialModule,
    HttpClientModule
  ],
  providers: [
      LoaderService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
