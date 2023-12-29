import {FromTelegramAuthDto} from "../Common/Auth/Contracts/FromTelegramAuthDto";
import {TelegramAuthDto} from "../Common/Auth/Contracts/TelegramAuthDto";


export class CommonDtoMapper {
    static getTelegramAuthDto(loginData: FromTelegramAuthDto) : TelegramAuthDto {
        return new TelegramAuthDto({
            authDateAsString: loginData.auth_date,
            firstName: loginData.first_name,
            hash: loginData.hash,
            userId: loginData.id,
            lastName: loginData.last_name,
            photoUrl: loginData.photo_url,
            username: loginData.username
        });
    }
}
