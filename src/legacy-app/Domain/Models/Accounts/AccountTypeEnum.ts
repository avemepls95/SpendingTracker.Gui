export enum AccountTypeEnum {
  DebitCard = "DebitCard",
  CreditCard = "CreditCard",
  Cash = "Cash",
  Brokerage = "Brokerage",
  Other = "Other"
}

export const AccountTypeToViewInfoMapping: Record<AccountTypeEnum, { label: string, icon: string }> = {
  [AccountTypeEnum.DebitCard]:
    {
      label: 'Дебетовая карта',
      icon: 'assets/images/bank-card-back-side-30.png'
    },
  [AccountTypeEnum.CreditCard]:
    {
      label: 'Кредитная карта',
      icon: 'assets/images/credit-card-emoji-30.png'
    },
  [AccountTypeEnum.Cash]:
    {
      label: 'Наличные',
      icon: 'assets/images/cash-30.png'
    },
  [AccountTypeEnum.Brokerage]:
    {
      label: 'Брокерский счет',
      icon: 'assets/images/bill-30.png'
    },
  [AccountTypeEnum.Other]:
    {
      label: 'Другое',
      icon: 'assets/images/money-bag-30.png'
    },
};
