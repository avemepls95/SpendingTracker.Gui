import { User } from 'src/app/Common/Model/User';
import { DebtDto } from '../Contracts/DebtDto';
import { Debt } from '../Model/Debt';


export class DebtsDtoMapper {
    static convertDtoToDebt(debtDto: DebtDto): Debt {
        return new Debt ({
            user: new User({ id: debtDto.user.id, username: debtDto.user.username }),
            amount: debtDto.value
        })
    }
}