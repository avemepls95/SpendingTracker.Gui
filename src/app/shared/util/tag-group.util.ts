import { Tag, UNGROUPED_TAG_LABEL } from '../../domain/models/models';

export interface TagGroup {
  readonly label: string;
  readonly tags: readonly Tag[];
}

/**
 * Ключ, по которому группа опознаётся.
 *
 * Регистр не учитывается: так на группы смотрит и сервер, и лист управления
 * группами, а расхождение показало бы «Место» и «место» двумя секциями там, где
 * у остальных - одна группа.
 */
export function normalizeGroupTitle(title: string): string {
  return title.trim().toLowerCase();
}

/**
 * Раскладывает теги по группам.
 *
 * Группы идут по алфавиту, теги без группы - последними: иначе безымянная
 * группа оказывалась бы первой и выглядела как основная.
 *
 * Написания, отличающиеся только регистром, - одна группа. Заголовком берётся
 * наименьшее написание в кодовом порядке, то есть при прочих равных то, что с
 * заглавной буквы: выбор не зависит от порядка тегов, а значит, заголовок не
 * скачет от того, какой тег завели раньше.
 *
 * declaredTitles - названия групп, заведённых явно. Из них получаются пустые
 * секции: группу, заведённую заранее, надо где-то видеть, иначе непонятно,
 * завелась ли она. Список нужен отдельно, потому что по одним тегам пустую
 * группу не восстановить. Там, где пустая секция не нужна (выбор тега), список
 * не передаётся.
 */
export function groupTags(
  tags: readonly Tag[],
  declaredTitles: readonly string[] = [],
): readonly TagGroup[] {
  const byGroup = new Map<string, { label: string; tags: Tag[] }>();

  for (const title of declaredTitles) {
    const label = title.trim();

    if (label === '') {
      continue;
    }

    byGroup.set(normalizeGroupTitle(label), { label, tags: [] });
  }

  for (const tag of tags) {
    const label = tag.group?.trim() || UNGROUPED_TAG_LABEL;
    const key = normalizeGroupTitle(label);
    const group = byGroup.get(key) ?? { label, tags: [] };

    group.label = group.label < label ? group.label : label;
    group.tags.push(tag);
    byGroup.set(key, group);
  }

  return [...byGroup.values()]
    .map((group) => ({
      label: group.label,
      tags: [...group.tags].sort((left, right) =>
        left.title.localeCompare(right.title, 'ru'),
      ),
    }))
    .sort((left, right) => {
      if (left.label === UNGROUPED_TAG_LABEL) {
        return 1;
      }

      if (right.label === UNGROUPED_TAG_LABEL) {
        return -1;
      }

      return left.label.localeCompare(right.label, 'ru');
    });
}
