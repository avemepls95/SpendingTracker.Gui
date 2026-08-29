import { Category } from '../../domain/models/models';

/** Категория в дереве: с уровнем вложенности и признаком раскрытия. */
export interface CategoryRow {
  readonly category: Category;
  readonly level: number;
  readonly hasChildren: boolean;
  readonly isExpanded: boolean;
}

/**
 * Раскладывает дерево категорий в плоский список строк.
 *
 * Дети идут сразу за родителем, свёрнутая ветка не разворачивается. Категория,
 * чей родитель не пришёл в списке, показывается как корневая: иначе целая
 * ветка молча исчезла бы с экрана.
 */
export function flattenCategoryTree(
  categories: readonly Category[],
  expandedIds: ReadonlySet<string>,
): readonly CategoryRow[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const childrenByParent = new Map<string | null, Category[]>();

  for (const category of categories) {
    const parentId =
      category.parentId && byId.has(category.parentId) ? category.parentId : null;

    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(category);
    childrenByParent.set(parentId, siblings);
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort((left, right) => left.title.localeCompare(right.title, 'ru'));
  }

  const rows: CategoryRow[] = [];

  const walk = (parentId: string | null, level: number): void => {
    for (const category of childrenByParent.get(parentId) ?? []) {
      const children = childrenByParent.get(category.id) ?? [];
      const isExpanded = expandedIds.has(category.id);

      rows.push({
        category,
        level,
        hasChildren: children.length > 0,
        isExpanded,
      });

      if (isExpanded) {
        walk(category.id, level + 1);
      }
    }
  };

  walk(null, 0);

  return rows;
}

/** Идентификаторы всех категорий, у которых есть дети. */
export function parentCategoryIds(categories: readonly Category[]): ReadonlySet<string> {
  const result = new Set<string>();
  for (const category of categories) {
    if (category.parentId) {
      result.add(category.parentId);
    }
  }

  return result;
}

/**
 * Категория и всё её поддерево.
 *
 * Нужно при перемещении: переносить ветку внутрь самой себя нельзя, поэтому
 * такие категории не предлагаются в выборе родителя.
 */
export function subtreeIds(
  categoryId: string,
  categories: readonly Category[],
): ReadonlySet<string> {
  const result = new Set<string>([categoryId]);

  let added = true;
  while (added) {
    added = false;
    for (const category of categories) {
      if (category.parentId && result.has(category.parentId) && !result.has(category.id)) {
        result.add(category.id);
        added = true;
      }
    }
  }

  return result;
}

/** Путь от корня: «Спорт › Зал». Обрывается, если предок не пришёл в списке. */
export function categoryPath(
  category: Category,
  categories: readonly Category[],
): string {
  const byId = new Map(categories.map((item) => [item.id, item]));
  const titles = [category.title];

  let current = category;
  const visited = new Set<string>([category.id]);

  while (current.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent || visited.has(parent.id)) {
      break;
    }

    titles.unshift(parent.title);
    visited.add(parent.id);
    current = parent;
  }

  return titles.join(' › ');
}

/** Идентификаторы всех предков категории - ветка раскрывается до неё. */
export function ancestorIds(
  category: Category,
  categories: readonly Category[],
): readonly string[] {
  const byId = new Map(categories.map((item) => [item.id, item]));
  const result: string[] = [];

  let current = category;
  const visited = new Set<string>([category.id]);

  while (current.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent || visited.has(parent.id)) {
      break;
    }

    result.push(parent.id);
    visited.add(parent.id);
    current = parent;
  }

  return result;
}
