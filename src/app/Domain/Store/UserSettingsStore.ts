import {Injectable} from "@angular/core";
import {BehaviorSubjectItem} from "../../Common/Dispatch/BehaviorSubjectItem";
import {SpendingApiService} from "../Services/spending-api.service";
import {finalize} from "rxjs/operators";
import {LoaderService} from "../../Common/Services/loader.service";
import {UserSettings} from "../Models/UserSettings";

@Injectable()
export class UserSettingsStore {
  readonly settings: BehaviorSubjectItem<UserSettings> = new BehaviorSubjectItem(new UserSettings({viewCurrencyId: ''}));

  constructor(
    private spendingApiService: SpendingApiService,
    private loaderService: LoaderService
  ) {
  }

  initialize() {
    this.fetch();
  }

  private fetch() {
    this.loaderService.show();
    this.spendingApiService.getUserSettings()
      .pipe(finalize(() => { this.loaderService.hide() }))
      .subscribe(
        response => {
         this.settings.value = response;
        }
      );
  }

  set(value: UserSettings) {
    this.settings.value = value;
    // this.spendingApiService.updateUserSettings()
    //   .pipe(finalize(() => { this.loaderService.hide() }))
    //   .subscribe(
    //     response => {
    //       this.settings.value = response;
    //     }
    //   );
  }
}
