import {FromTelegramAuthDto} from "../Common/Auth/Contracts/FromTelegramAuthDto";
import {TelegramToBalanceAuthDto} from "../Common/Auth/Contracts/TelegramToBalanceAuthDto";


export class CommonDtoMapper {
    static getTelegramAuthDto(loginData: FromTelegramAuthDto) {
        return new TelegramToBalanceAuthDto({
            authDate: loginData.auth_date.toString(),
            firstName: loginData.first_name,
            hash: loginData.hash,
            userId: loginData.id,
            lastName: loginData.last_name,
            photoUrl: loginData.photo_url,
        });
    }
}
