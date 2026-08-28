import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {UserAccount} from "../../../Models/Accounts/UserAccount";
import {OpenCardActionEnum} from "../../../../Common/ControlLayer/OpenCardActionEnum";
import {FormControl} from "@angular/forms";
import {ReplaySubject, Subject, takeUntil} from "rxjs";
import {Currency} from "../../../Models/Currency";
import {CurrenciesStore} from "../../../Store/CurrenciesStore";
import {CloseCardActionEnum} from "../../../../Common/ControlLayer/CloseCardActionEnum";
import {AccountTypeEnum, AccountTypeToViewInfoMapping} from "../../../Models/Accounts/AccountTypeEnum";
import {CloseAccountCardActionEnum} from "./CloseAccountCardActionEnum";

@Component({
  selector: 'app-account-card',
  templateUrl: './account-card.component.html',
  styleUrls: ['./account-card.component.scss']
})
export class AccountCardComponent implements OnInit {
  public AccountTypeToViewInfoMapping = AccountTypeToViewInfoMapping;
  public accountTypes = Object.values(AccountTypeEnum);

  account: UserAccount;
  currencies: Currency[];

  headerTitle: string;
  currentAction: OpenCardActionEnum;

  public currencyFilterCtrl: FormControl = new FormControl();
  protected _onDestroy = new Subject<void>();
  public filteredCurrencies: ReplaySubject<Currency[]> = new ReplaySubject<Currency[]>(1);

  constructor(
    private dialogRef: MatDialogRef<AccountCardComponent>,
    currenciesStore: CurrenciesStore,
    @Inject(MAT_DIALOG_DATA) public data: { action: OpenCardActionEnum, account: UserAccount })
  {
    if (data.action == OpenCardActionEnum.None) {
      throw Error("Invalid open card action");
    }

    if (data.action == OpenCardActionEnum.Create) {
      this.account = new UserAccount();
      this.headerTitle = "Создать счет";
    }
    else if (data.action == OpenCardActionEnum.Update) {
      this.account = data.account;
      this.headerTitle = "Редактировать счет";
    }
    else {
      throw Error("Invalid action");
    }

    this.currentAction = data.action;

    currenciesStore.currencies.value$.subscribe(v => this.currencies = v);
  }

  doAction() {
    this.dialogRef.close({ action: CloseAccountCardActionEnum.Do, data: {account: this.account} });
  }

  closeDialog() {
    this.dialogRef.close({ action: CloseAccountCardActionEnum.Cancel });
  }

  ngOnInit(): void {
    this.filteredCurrencies.next(this.currencies.slice());
    this.currencyFilterCtrl.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe(() => {
        this.filterCurrencies();
      });
  }

  private filterCurrencies() {
    if (!this.currencies) {
      return;
    }

    let search = this.currencyFilterCtrl.value;
    if (!search) {
      this.filteredCurrencies.next(this.currencies.slice());
      return;
    } else {
      search = search.toLowerCase();
    }

    this.filteredCurrencies.next(
      this.currencies.filter(bank => bank.code.toLowerCase().indexOf(search) > -1)
    );
  }

  canCreate(){
    return this.account.amount > 0
      && !!this.account.currencyId
      && !!this.account.name
      && !!this.account.type;
  }

  delete() {
    this.dialogRef.close({ action: CloseAccountCardActionEnum.Delete });
  }

  protected readonly OpenCardActionEnum = OpenCardActionEnum;
}
