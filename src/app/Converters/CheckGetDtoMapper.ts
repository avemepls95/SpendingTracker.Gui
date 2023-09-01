import { User } from 'src/app/Common/Model/User';
import { CheckDiscountDto } from '../Contracts/Check/check-discount-dto';
import { DISCOUNT_TYPE_DTO } from '../Contracts/Check/discount-type-dto.enum';
import { GetCheckDto } from '../Contracts/Check/Get/GetCheckDto';
import { GetPaymentDto } from '../Contracts/Check/Get/GetPaymentDto';
import { GetPositionDto } from '../Contracts/Check/Get/GetPositionDto';
import { Check } from '../Model/Check';
import { Consumption } from '../Model/Consumption';
import { Discount } from '../Model/Discount/discount';
import { DISCOUNT_TYPE } from '../Model/Discount/discount-type.enum';
import { Payment } from '../Model/Payment';
import { Position } from '../Model/Position';


export class CheckGetDtoMapper {

    static convertDtoToCheck(checkDto: GetCheckDto): Check {
        return new Check({
            id: checkDto.id,
            title: checkDto.title,
            isReadyForProcess: checkDto.isReadyForProcess,
            state: checkDto.state,
            positions: CheckGetDtoMapper.convertDtoToPosition(checkDto.positions),
            payments: CheckGetDtoMapper.convertDtoToPayment(checkDto.payments),
            createdAt: new Date(checkDto.createdAt),
            roles: checkDto.roles,
            discount: this.convertDtoToDiscount(checkDto.discount)
        })
    }

    static convertDtoToPosition(positionDtoArray: GetPositionDto[]): Position[] {
        return positionDtoArray.map(p => new Position({
            title: p.title,
            amount: p.amount,
            consumptions: p.consumptions.map(c =>
                new Consumption({
                    amount: c.amount,
                    user: c.user
                })
            ),
            applyDiscount: !!p.discount && p.discount.value > 0
        }));
    }

    static convertDtoToPayment(paymentDtoArray: GetPaymentDto[]): Payment[] {
        return paymentDtoArray.map(p => new Payment({
            amount: p.amount,
            user: new User({ id: p.user.id, username: p.user.username })
        }))
    }

    static convertDtoToDiscount(discountDto: CheckDiscountDto) : Discount {
        return discountDto ? new Discount({
            apply: discountDto.value != 0,
            type: this.convertDtoToDiscountType(DISCOUNT_TYPE_DTO[discountDto.type]),
            value: discountDto.value
        }) : new Discount({
            apply: false,
            type: DISCOUNT_TYPE.PERCENT,
            value: 0
        })
    }

    static convertDtoToDiscountType(discountType: DISCOUNT_TYPE_DTO): DISCOUNT_TYPE {
        return discountType == DISCOUNT_TYPE_DTO.ABSOLUTE ?
            DISCOUNT_TYPE.ABSOLUTE : DISCOUNT_TYPE.PERCENT;
    }
}