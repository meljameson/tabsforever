import Fuse from 'fuse.js';
import type { Card, Collection, Root } from '../model/types';

export interface Filter {
  query: string;
  tags: string[];
}

export const isFiltering = (filter: Filter) => filter.query.trim() !== '' || filter.tags.length > 0;

interface Entry {
  card: Card;
  collectionId: string;
}

/**
 * Narrows collections to matching cards. A collection whose title matches the
 * query keeps all of its cards (subject to the tag filter). Collections with
 * nothing left are dropped.
 */
export function filterCollections(root: Root, filter: Filter): Collection[] {
  if (!isFiltering(filter)) return root.collections;

  const hasTags = (card: Card) => filter.tags.every((t) => card.tags.includes(t));
  const query = filter.query.trim();

  let cardMatches: Set<string> | null = null;
  let titleMatches = new Set<string>();
  if (query) {
    const entries: Entry[] = root.collections.flatMap((c) =>
      c.cards.map((card) => ({ card, collectionId: c.id })),
    );
    const cardFuse = new Fuse(entries, {
      keys: [
        { name: 'card.customTitle', weight: 2 },
        { name: 'card.title', weight: 2 },
        { name: 'card.url', weight: 1 },
        { name: 'card.note', weight: 1 },
        { name: 'card.tags', weight: 1.5 },
      ],
      threshold: 0.35,
      ignoreLocation: true,
    });
    cardMatches = new Set(cardFuse.search(query).map((r) => r.item.card.id));

    const collectionFuse = new Fuse(root.collections, {
      keys: ['title'],
      threshold: 0.3,
      ignoreLocation: true,
    });
    titleMatches = new Set(collectionFuse.search(query).map((r) => r.item.id));
  }

  return root.collections.flatMap((collection) => {
    const cards = collection.cards.filter(
      (card) =>
        hasTags(card) &&
        (!cardMatches || titleMatches.has(collection.id) || cardMatches.has(card.id)),
    );
    return cards.length > 0 ? [{ ...collection, cards }] : [];
  });
}
