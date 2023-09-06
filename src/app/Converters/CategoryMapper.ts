import {GetCategoriesResponseItem} from "../Domain/Services/Contracts/GetCategoriesResponseItem";
import {Category} from "../Domain/Models/Category";


export class CategoryMapper {
    static convertFromDto(dto: GetCategoriesResponseItem): Category {
        return new Category ({
            id: dto.id,
            title: dto.title,
            createDate: dto.createDate,
        })
    }
}
