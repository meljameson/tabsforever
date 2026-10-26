// Finds links saved more than once (across or within collections) and
// resolves them by keeping one chosen copy.
import { findCard, normalizeTags, urlKey } from './ops';
import type { Card, Collection, Op, Root } from './types';

export interface DuplicateCopy {
  card: Card;
  collection: Collection;
  index: number;
}

export interface DuplicateGroup {
  key: string;
  /** Copies in dashboard order. */
  copies: DuplicateCopy[];
}

/** Groups of two or more cards sharing a link, in order of first appearance. */
export function findDuplicates(root: Root): DuplicateGroup[] {
  const groups = new Map<string, DuplicateCopy[]>();
  for (const collection of root.collections) {
    collection.cards.forEach((card, index) => {
      const key = urlKey(card.url);
      groups.set(key, [...(groups.get(key) ?? []), { card, collection, index }]);
    });
  }
  return [...groups].filter(([, copies]) => copies.length > 1).map(([key, copies]) => ({ key, copies }));
}

/** Card ids that have at least one other copy somewhere. */
export function duplicateCardIds(root: Root): Set<string> {
  return new Set(findDuplicates(root).flatMap((g) => g.copies.map((c) => c.card.id)));
}

/**
 * Keeps `cardId` and removes every other card with the same link. Tags from
 * the removed copies are merged in, and their note is used if the kept card
 * has none. Returns the op plus an undo that restores the exact prior state.
 */
export function keepOnly(root: Root, cardId: string): { op: Op; undo: Op; removed: number } | null {
  const kept = findCard(root, cardId);
  if (!kept) return null;
  const key = urlKey(kept.card.url);
  const others = findDuplicates(root)
    .find((g) => g.key === key)
    ?.copies.filter((c) => c.card.id !== cardId);
  if (!others || others.length === 0) return null;

  const removedIds = new Set(others.map((c) => c.card.id));
  const merged: Card = {
    ...kept.card,
    tags: normalizeTags([...kept.card.tags, ...others.flatMap((c) => c.card.tags)]),
    note: kept.card.note || others.find((c) => c.card.note)?.card.note,
  };

  const op: Op = (r) => ({
    ...r,
    collections: r.collections.map((c) => {
      if (!c.cards.some((card) => card.id === cardId || removedIds.has(card.id))) return c;
      const cards = c.cards
        .filter((card) => !removedIds.has(card.id))
        .map((card) => (card.id === cardId ? merged : card));
      return { ...c, cards, updatedAt: Date.now() };
    }),
  });

  // Reinsert removed copies at their original positions (ascending, so
  // earlier inserts don't shift later ones) and restore the kept card.
  const undo: Op = (r) => {
    const byCollection = new Map<string, DuplicateCopy[]>();
    for (const copy of others) {
      byCollection.set(copy.collection.id, [...(byCollection.get(copy.collection.id) ?? []), copy]);
    }
    return {
      ...r,
      collections: r.collections.map((c) => {
        const restore = byCollection.get(c.id);
        const cards = c.cards.map((card) => (card.id === cardId ? kept.card : card));
        if (restore) {
          for (const copy of [...restore].sort((a, b) => a.index - b.index)) {
            cards.splice(Math.min(copy.index, cards.length), 0, copy.card);
          }
        }
        return { ...c, cards };
      }),
    };
  };

  return { op, undo, removed: others.length };
}
