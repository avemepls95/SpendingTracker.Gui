import { Tag } from '../../domain/models/models';

/**
 * Теги, которые трата получает от своей валюты.
 *
 * Тег, стоящий на трате и собственной связью, сюда не попадает: его
 * показывают как собственный, потому что только собственную связь можно снять.
 */
export function currencyTagsOf(
  allTags: readonly Tag[],
  currencyId: string,
  ownTagIds: readonly string[],
): readonly Tag[] {
  return allTags.filter(
    (tag) => tag.currencyIds.includes(currencyId) && !ownTagIds.includes(tag.id),
  );
}
