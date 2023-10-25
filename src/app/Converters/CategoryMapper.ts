import {Category} from "../Domain/Models/Category";
import {CategoryDto} from "../Domain/Services/Contracts/CategoryDto";


export class CategoryMapper {
    static convertFromDto(dto: CategoryDto): Category {
      let parents = dto.parents.map(p => this.ProcessCategory(p));

      return new Category({
        id: dto.id,
        title: dto.title,
        createDate: dto.createDate,
        parents: parents
      });
    }

    private static ProcessCategory(dto: CategoryDto): Category {
      let result = new Category({
        id: dto.id,
        createDate: dto.createDate,
        title: dto.title,
        parents: []
      })

      for(let i = 0;i < dto.parents.length; i++){
        let parentDto = dto.parents[i];
        let parent = this.ProcessCategory(parentDto);
        result.parents.push(parent);
      }

      return result;
    }
}
