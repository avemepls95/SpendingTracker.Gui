import {FromTelegramAuthDto} from "./Common/Auth/Contracts/FromTelegramAuthDto";

export class LocalStorageManager {
    static userFirstNameKey = 'userFirstName';
    static userLastNameKey = 'userLastName';
    static userAuthDateKey = 'userAuthDate';
    static userHashKey = 'userHash';
    static userLocalIdKey = 'userLocalId';
    static userLocalNameKey = 'userLocalName';
    static userPhotoUrlKey = 'userPhotoUrl';
    static tokenKey = 'token';
    static tokenExpireDateKey = 'tokenExpireDate';
    static refreshTokenKey = 'refreshToken';

    private static authFieldsKeys = [
        LocalStorageManager.userFirstNameKey,
        LocalStorageManager.userLastNameKey,
        LocalStorageManager.userAuthDateKey,
        LocalStorageManager.userHashKey,
        LocalStorageManager.userLocalIdKey,
        LocalStorageManager.userPhotoUrlKey,
    ];

    static setUserData(data: FromTelegramAuthDto) {
        LocalStorageManager.authFieldsKeys.forEach(key => {
            localStorage.removeItem(key);
        });

        if (this.isTelegramData(data)){
            this.setUserDataFromTelegram(data as FromTelegramAuthDto);
            return;
        }

        throw Error("Unrecognized auth method");
    }

    private static setUserDataFromTelegram(data: FromTelegramAuthDto) {
        localStorage.setItem(this.userFirstNameKey, data.first_name);
        localStorage.setItem(this.userLastNameKey, data.last_name);
            localStorage.setItem(this.userHashKey, data.hash);
        // localStorage.setItem(this.userIdKey, data.id.toString());
        localStorage.setItem(this.userPhotoUrlKey, data.photo_url);
    }

    private static isTelegramData(data : any) {
        return data.hasOwnProperty('photo_url');
    }

    static setUserLocalInformation(id: string) {
        localStorage.setItem(LocalStorageManager.userLocalIdKey, id.toString());
    }
}
