import {Component, LOCALE_ID} from '@angular/core';
import {UserSettingsStore} from "../../Store/UserSettingsStore";
import {CurrenciesStore} from "../../Store/CurrenciesStore";
import {zip} from "rxjs";
import {Currency} from "../../Models/Currency";
import {SpendingApiService} from "../../Services/spending-api.service";
import {finalize} from "rxjs/operators";
import {LoaderService} from "../../../Common/Services/loader.service";
import {GetUserAccountsResponse} from "../../Services/Contracts/Accounts/GetUserAccountsResponse";
import {OpenCardActionEnum} from "../../../Common/ControlLayer/OpenCardActionEnum";
import {MatDialog} from "@angular/material/dialog";
import {CloseCardModel} from "../../../Common/ControlLayer/CloseCardModel";
import {CloseCardActionEnum} from "../../../Common/ControlLayer/CloseCardActionEnum";
import {AccountCardComponent} from "./account-card/account-card.component";
import {CreateUserAccountRequest} from "../../Services/Contracts/Accounts/CreateUserAccountRequest";
import { AccountTypeToViewInfoMapping } from '../../Models/Accounts/AccountTypeEnum';
import {CurrencyService} from "../../Services/CurrencyService";
import {UpdateUserAccountRequest} from "../../Services/Contracts/Accounts/UpdateUserAccountRequest";
import {UserAccountDto} from "../../Services/Contracts/Accounts/UserAccountDto";
import {UserAccount} from "../../Models/Accounts/UserAccount";
import {CloseAccountCardActionEnum} from "./account-card/CloseAccountCardActionEnum";
import {CloseAccountCardModel} from "./account-card/CloseAccountCardModel";
import {
  ConfirmDialogComponent,
  ConfirmDialogModel
} from "../../../Common/Components/confirm-dialog/confirm-dialog.component";

@Component({
  selector: 'app-accounts',
  templateUrl: './accounts.component.html',
  styleUrls: ['./accounts.component.scss'],
  providers: [
    { provide: LOCALE_ID, useValue: 'ru' }
  ]
})
export class AccountsComponent {

  currencies: Currency[];
  currentCurrency: Currency;
  accountsInfo: GetUserAccountsResponse;

  displayedColumns: string[] = ['name', 'type', 'currency', 'originalCurrencyAmount'];

  AccountTypeToLabelMapping = AccountTypeToViewInfoMapping;

  constructor(
    private userSettingsStore: UserSettingsStore,
    private currenciesStore: CurrenciesStore,
    private spendingApiService: SpendingApiService,
    private loaderService: LoaderService,
    private dialog: MatDialog,
    public currencyService: CurrencyService
  ) {
    zip([this.userSettingsStore.settings.value$, this.currenciesStore.currencies.value$])
      .pipe()
      .subscribe(([userSettings, currencies]) => {
        if (!userSettings.viewCurrencyId) {
          return;
        }

        this.currencies = currencies;
        this.currentCurrency = currencies.find(c => c.id == userSettings.viewCurrencyId)!;

        this.loadAccounts();
      })
  }

  actualizeTargetCurrencyAmoutColumn(){
    let columnKey = 'targetCurrencyAmount';
    let shoudldShowColumn = this.accountsInfo.accounts.some(a => a.originalCurrencyId != this.currentCurrency.id);
    let columnIndex = this.displayedColumns.findIndex(c => c == columnKey);
    if (columnIndex == -1) {
      if (shoudldShowColumn){
        this.displayedColumns.push(columnKey);
      }
    }
    else {
      if (!shoudldShowColumn){
        this.displayedColumns.splice(columnIndex, 1);
      }
    }
  }

  loadAccounts() {
    this.loaderService.show();
    this.spendingApiService.getUserAccounts(this.currentCurrency.id).pipe(
      finalize(() => this.loaderService.hide())
    ).subscribe(
      (response) => {
        this.accountsInfo = response;
        this.accountsInfo.accounts = this.accountsInfo.accounts.sort((a1, a2) => a2.targetCurrencyAmount - a1.targetCurrencyAmount);
        this.actualizeTargetCurrencyAmoutColumn();
      },
      (error) => console.error(error)
    );
  }

  create() {
    const dialogRef = this.dialog.open(AccountCardComponent, {
      width: '370px',
      data: {action: OpenCardActionEnum.Create}
    });

    dialogRef.afterClosed().subscribe((result: CloseCardModel) => {
      if (result.action == CloseCardActionEnum.Cancel) {
        return;
      }

      let request = new CreateUserAccountRequest({
        amount: result.data.account.amount,
        currencyId: result.data.account.currencyId,
        name: result.data.account.name,
        type: result.data.account.type
      });
      this.loaderService.show();
      this.spendingApiService.createUserAccount(request)
        .pipe(finalize(() => this.loaderService.hide()))
        .subscribe(
          _ => this.loadAccounts(),
          error => console.error(error)
        );
    });
  }

  openAccountCard(account: UserAccountDto) {
    const dialogRef = this.dialog.open(AccountCardComponent, {
      width: '370px',
      data: {
        action: OpenCardActionEnum.Update,
        account: new UserAccount({
          amount: account.originalCurrencyAmount,
          currencyId: account.originalCurrencyId,
          id: account.id,
          name: account.name,
          type: account.type
        })
      }
    });

    dialogRef.afterClosed().subscribe((result: CloseAccountCardModel) => {
      if (result.action == CloseAccountCardActionEnum.Cancel) {
        return;
      }

      if (result.action == CloseAccountCardActionEnum.Delete) {
        this.delete(account.id);
        return;
      }

      let request = new UpdateUserAccountRequest({
        id: result.data.account.id,
        amount: result.data.account.amount,
        currencyId: result.data.account.currencyId,
        name: result.data.account.name,
        type: result.data.account.type
      });
      this.loaderService.show();
      this.spendingApiService.updateUserAccount(request)
        .pipe(finalize(() => this.loaderService.hide()))
        .subscribe(
          _ => this.loadAccounts(),
          error => console.error(error)
        );
    });
  }

  delete(id: string) {
    const dialogData = new ConfirmDialogModel('Подтверждение', 'Вы уверены, что хотите удалить счет?');
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      maxWidth: "420px",
      height: "160px",
      data: dialogData
    });

    dialogRef.afterClosed().subscribe(dialogResult => {
      if (!dialogResult)
        return;

      this.loaderService.show();
      this.spendingApiService.deleteUserAccount(id)
        .pipe(finalize(() => this.loaderService.hide()))
        .subscribe(
          _ => this.loadAccounts(),
          error => console.error(error)
        );
      return;
    });
  }
}
