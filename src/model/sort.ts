import type { Collection } from './types';

export const COLLECTION_SORTS = {
  manual: 'Manual',
  name: 'Name',
  newest: 'Newest',
  updated: 'Recently updated',
  size: 'Most tabs',
} as const;

export type CollectionSort = keyof typeof COLLECTION_SORTS;

const byName = (a: Collection, b: Collection) =>
  a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });

/** Display order only; the stored (manual) order is never changed. */
export function sortCollections(collections: Collection[], sort: CollectionSort): Collection[] {
  const sorted = [...collections];
  switch (sort) {
    case 'manual':
      return collections;
    case 'name':
      return sorted.sort(byName);
    case 'newest':
      return sorted.sort((a, b) => b.createdAt - a.createdAt);
    case 'updated':
      return sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    case 'size':
      return sorted.sort((a, b) => b.cards.length - a.cards.length || byName(a, b));
  }
}
