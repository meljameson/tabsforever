// Translates a finished drag (what was dragged, where it was dropped) into an op.
import {
  addCards,
  cardFromTab,
  collectionFromGroup,
  collectionIndex,
  dedupeCards,
  deleteCard,
  findCard,
  insertCollection,
  moveCard,
  moveCollection,
  placeholderCollection,
} from './ops';
import type { Card, Collection, GroupLike, Op, Root, TabLike } from './types';

export type DragData =
  | { type: 'tab'; tab: TabLike }
  | { type: 'group'; group: GroupLike; tabs: TabLike[] }
  | { type: 'card'; cardId: string }
  | { type: 'collection'; collectionId: string };

export type DropData =
  | { type: 'card'; cardId: string }
  | { type: 'collection'; collectionId: string }
  | { type: 'collection-body'; collectionId: string }
  | { type: 'new-collection' };

/** Where a dropped tab or card should land: collection id + index, or a new collection. */
function target(root: Root, drop: DropData): { collectionId: string; index: number } | 'new' | null {
  switch (drop.type) {
    case 'new-collection':
      return 'new';
    case 'card': {
      const found = findCard(root, drop.cardId);
      return found ? { collectionId: found.collection.id, index: found.index } : null;
    }
    case 'collection':
    case 'collection-body': {
      const collection = root.collections.find((c) => c.id === drop.collectionId);
      return collection ? { collectionId: collection.id, index: collection.cards.length } : null;
    }
  }
}

/** Links the drag carries; collections carry none. */
function draggedCards(root: Root, drag: DragData): Card[] {
  switch (drag.type) {
    case 'tab': {
      const card = cardFromTab(drag.tab);
      return card ? [card] : [];
    }
    case 'group':
      return drag.tabs.flatMap((tab) => cardFromTab(tab) ?? []);
    case 'card': {
      const found = findCard(root, drag.cardId);
      return found ? [found.card] : [];
    }
    case 'collection':
      return [];
  }
}

/**
 * How many dragged links the target collection already has. Cards moving
 * within their own collection don't count.
 */
export function duplicatesOnDrop(root: Root, drag: DragData, drop: DropData): { collection: Collection; count: number } | null {
  const dest = target(root, drop);
  if (!dest || dest === 'new') return null;
  const collection = root.collections.find((c) => c.id === dest.collectionId);
  if (!collection) return null;
  if (drag.type === 'card' && findCard(root, drag.cardId)?.collection.id === collection.id) return null;
  const cards = dedupeCards(draggedCards(root, drag));
  const count = cards.length - dedupeCards(cards, collection.cards).length;
  return count > 0 ? { collection, count } : null;
}

export function dropOp(root: Root, drag: DragData, drop: DropData): Op | null {
  if (drag.type === 'collection') {
    if (drop.type !== 'collection' || drop.collectionId === drag.collectionId) return null;
    const to = collectionIndex(root, drop.collectionId);
    return to === -1 ? null : moveCollection(drag.collectionId, to);
  }

  const dest = target(root, drop);
  if (!dest) return null;

  // Nothing new would be added: everything dragged is already there.
  const duplicates = duplicatesOnDrop(root, drag, drop);
  if (duplicates && duplicates.count >= dedupeCards(draggedCards(root, drag)).length) return null;

  if (drag.type === 'tab') {
    const card = cardFromTab(drag.tab);
    if (!card) return null;
    if (dest === 'new') return insertCollection(placeholderCollection(card.title || 'New collection', [card]));
    return addCards(dest.collectionId, [card], dest.index);
  }

  if (drag.type === 'group') {
    const collection = collectionFromGroup(drag.group, drag.tabs);
    if (!collection) return null;
    if (dest === 'new') return insertCollection(collection);
    return addCards(dest.collectionId, collection.cards, dest.index);
  }

  // drag.type === 'card'
  if (drop.type === 'card' && drop.cardId === drag.cardId) return null;
  const found = findCard(root, drag.cardId);
  if (!found) return null;
  if (dest === 'new') {
    const collection = placeholderCollection(found.card.customTitle || found.card.title || 'New collection', [
      found.card,
    ]);
    return (r) => insertCollection(collection)(deleteCard(drag.cardId)(r));
  }
  return moveCard(drag.cardId, dest.collectionId, dest.index);
}
