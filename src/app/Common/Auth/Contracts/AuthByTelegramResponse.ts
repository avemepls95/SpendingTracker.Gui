import {TokenInformationDto} from "./TokenInformationDto";
import * as uuid from 'uuid';

export class AuthByTelegramResponse {
    tokenInformation: TokenInformationDto;
    id: string;
    firstName: string;
    lastName: string;
    photoUrl: string;
}
