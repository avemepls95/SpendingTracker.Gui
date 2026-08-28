import {FromTelegramAuthDto} from "../Common/Auth/Contracts/FromTelegramAuthDto";
import {TelegramAuthDto} from "../Common/Auth/Contracts/TelegramAuthDto";


export class TelegramDtoMapper {
  static fromWidget(loginData: FromTelegramAuthDto): TelegramAuthDto {
    let check_string = Object.keys(loginData)
      // @ts-ignore
      .map(key => `${key}=${loginData[key]}`)
      .join('&');

    return new TelegramAuthDto({
      firstName: loginData.first_name,
      userId: loginData.id,
      lastName: loginData.last_name,
      username: loginData.username,
      checkString: check_string,
      authType: 'widget'
    });
  }
}
