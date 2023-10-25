export class CategoryDto {
  id: string;
  title: string;
  createDate: Date;
  parents: CategoryDto[];
}
