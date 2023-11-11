import {SnackbarOptions} from '../ControlLayer/SnackbarOptions';
import {MatSnackBar} from '@angular/material/snack-bar';
import {SnackBarColor} from '../ControlLayer/SnackBarColor.enum';
import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SnackbarService {

  constructor(private _snackBar: MatSnackBar) {
  }

  // setSnackbar(snackbar: MatSnackBar) {
  //     this.snackbar = snackbar;
  // }

  private openSnackBar(options: SnackbarOptions) {
    var colorClass = 'snackbar-' + options.backgroundColor.toString();
    if (options.action == '')
      options.action = 'Закрыть';

    this._snackBar.open(
      options.message,
      undefined,
      {
        duration: options.duration,
        verticalPosition: "top",
        horizontalPosition: "center",
        panelClass: ['snackbar', colorClass]
      }
    );
  }

  showSuccessMessage() {
    let successText = 'Успех!';
    let closeText = 'Закрыть';
    this.openSnackBar(new SnackbarOptions({
      backgroundColor: SnackBarColor.Success,
      message: successText,
      action: closeText,
      duration: 2000
    }));
  }

  showErrorMessage(message: string) {
    let closeText = 'Закрыть';
    this.openSnackBar(new SnackbarOptions({
      backgroundColor: SnackBarColor.Error,
      message: message,
      action: closeText,
      duration: 3000
    }));
  }

  showInformationMessage(message: string): void {
    let closeText = 'Закрыть';
    this.openSnackBar(new SnackbarOptions({
      backgroundColor: SnackBarColor.Information,
      message: message,
      action: closeText,
      duration: 2000
    }));
  }

  showMessage(message: string): void {
    let closeText = 'Закрыть';
    this.openSnackBar(new SnackbarOptions({
      backgroundColor: SnackBarColor.Default,
      message: message,
      action: closeText,
      duration: 2000
    }));
  }
}
