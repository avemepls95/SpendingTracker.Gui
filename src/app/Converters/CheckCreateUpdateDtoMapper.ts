import { CheckDiscountDto } from '../Contracts/Check/check-discount-dto';
import { CreateUpdateCheckDto } from '../Contracts/Check/CreateUpdate/CreateUpdateCheckDto';
import { CreateUpdateConsumptionDto } from '../Contracts/Check/CreateUpdate/CreateUpdateConsumptionDto';
import { CreateUpdatePaymentDto } from '../Contracts/Check/CreateUpdate/CreateUpdatePaymentDto';
import { CreateUpdatePositionDto } from '../Contracts/Check/CreateUpdate/CreateUpdatePositionDto';
import { DISCOUNT_TYPE_DTO } from '../Contracts/Check/discount-type-dto.enum';
import { PositionDiscountDto } from '../Contracts/Check/position-discount-dto';
import { POSITION_DISCOUNT_TYPE_DTO } from '../Contracts/Check/position-discount-type-dto';
import { Check } from '../Model/Check';
import { DISCOUNT_TYPE } from '../Model/Discount/discount-type.enum';
import { Payment } from '../Model/Payment';


export class CheckCreateUpdateDtoMapper {

    static convertCheckToDto(check: Check): CreateUpdateCheckDto {
        return new CreateUpdateCheckDto({
            id: check.id,
            title: check.title,
            positions: CheckCreateUpdateDtoMapper.convertPositionToDto(check),
            payments: CheckCreateUpdateDtoMapper.convertPaymentToDto(check.payments),
            discount: new CheckDiscountDto({
                type: DISCOUNT_TYPE_DTO[this.convertDiscountTypeToDto(check.discount.type)],
                value: check.discount.value
            })
        })
    }

    static convertPositionToDto(check: Check): CreateUpdatePositionDto[] {
        return check.positions.map(p => new CreateUpdatePositionDto({
            title: p.title,
            amount: p.amount,
            consumptions: p.consumptions.map(c => new CreateUpdateConsumptionDto({
                amount: c.amount,
                userId: c.user.id
            })),
            applyDiscount: p.applyDiscount,
            discount: new PositionDiscountDto({
                type: POSITION_DISCOUNT_TYPE_DTO[POSITION_DISCOUNT_TYPE_DTO.INHERITED],
                value: p.applyDiscount ? check.discount.value : null
            })
        }));
    }

    static convertPaymentToDto(payments: Payment[]): CreateUpdatePaymentDto[] {
        return payments.map(p => new CreateUpdatePaymentDto({
            amount: p.amount,
            userId: p.user.id
        }));
    }

    static convertDiscountTypeToDto(discountType: DISCOUNT_TYPE): DISCOUNT_TYPE_DTO {
        return discountType == DISCOUNT_TYPE.ABSOLUTE ?
            DISCOUNT_TYPE_DTO.ABSOLUTE : DISCOUNT_TYPE_DTO.RELATIVE;
    }
}