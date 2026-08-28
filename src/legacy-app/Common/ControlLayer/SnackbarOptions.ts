import { SnackBarColor } from './SnackBarColor.enum';

export class SnackbarOptions {
    backgroundColor: SnackBarColor = SnackBarColor.Default;
    message: string = "";
    action: string = "";
    duration: number | undefined = undefined;

    public constructor(
        fields?: {
            backgroundColor?: SnackBarColor;
            message?: string;
            action?: string;
            duration?: number;
        }) {
        if (fields) Object.assign(this, fields);
    }
}
