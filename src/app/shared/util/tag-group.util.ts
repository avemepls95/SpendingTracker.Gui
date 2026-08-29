import { Tag, UNGROUPED_TAG_LABEL } from '../../domain/models/models';

export interface TagGroup {
  readonly label: string;
  readonly tags: readonly Tag[];
}

/**
 * Раскладывает теги по группам.
 *
 * Группы идут по алфавиту, теги без группы - последними: иначе безымянная
 * группа оказывалась бы первой и выглядела как основная.
 */
export function groupTags(tags: readonly Tag[]): readonly TagGroup[] {
  const byGroup = new Map<string, Tag[]>();

  for (const tag of tags) {
    const label = tag.group ?? UNGROUPED_TAG_LABEL;
    const group = byGroup.get(label) ?? [];
    group.push(tag);
    byGroup.set(label, group);
  }

  return [...byGroup.entries()]
    .map(([label, groupTagsList]) => ({
      label,
      tags: [...groupTagsList].sort((left, right) =>
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
