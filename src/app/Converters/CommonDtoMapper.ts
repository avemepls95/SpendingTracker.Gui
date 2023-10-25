import {FromTelegramAuthDto} from "../Common/Auth/Contracts/FromTelegramAuthDto";
import {TelegramToBalanceAuthDto} from "../Common/Auth/Contracts/TelegramToBalanceAuthDto";


export class CommonDtoMapper {
    static getTelegramAuthDto(loginData: FromTelegramAuthDto) : TelegramToBalanceAuthDto {
        return new TelegramToBalanceAuthDto({
            firstName: loginData.first_name,
            hash: loginData.hash,
            userId: loginData.id,
            lastName: loginData.last_name,
            photoUrl: loginData.photo_url,
        });
    }
}
