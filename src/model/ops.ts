// Pure, immutable operations on the Root. Both the dashboard and the
// background script mutate data exclusively through these.
import { TAB_GROUP_COLORS, type Card, type Collection, type GroupLike, type Op, type Root, type TabGroupColor, type TabLike } from './types';

const OPENABLE_PROTOCOLS = new Set(['http:', 'https:', 'ftp:']);
/** Data-URL favicons above this size are dropped to keep storage lean. */
const MAX_FAVICON_LENGTH = 20_000;

export const emptyRoot = (): Root => ({ schemaVersion: 1, collections: [] });

export const newId = (): string => crypto.randomUUID();

export function isOpenable(url: string): boolean {
  try {
    return OPENABLE_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

export function cardTitle(card: Card): string {
  return card.customTitle || card.title || hostname(card.url) || card.url;
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function normalizeTags(tags: string[]): string[] {
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().replace(/^#+/, '').trim().toLowerCase();
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out;
}

export function createCard(fields: Omit<Card, 'id' | 'createdAt' | 'tags'> & { tags?: string[] }): Card {
  return { ...fields, tags: normalizeTags(fields.tags ?? []), id: newId(), createdAt: Date.now() };
}

/** Returns null for tabs that can't usefully be saved (new tab pages, browser internals). */
export function cardFromTab(tab: TabLike): Card | null {
  if (!tab.url || !isOpenable(tab.url)) return null;
  const favIconUrl =
    tab.favIconUrl && tab.favIconUrl.length <= MAX_FAVICON_LENGTH ? tab.favIconUrl : undefined;
  return createCard({ url: tab.url, title: tab.title ?? '', favIconUrl });
}

export function createCollection(title: string, cards: Card[] = [], extra: Partial<Collection> = {}): Collection {
  const now = Date.now();
  return { id: newId(), title, cards, collapsed: false, createdAt: now, updatedAt: now, ...extra };
}

export const isGrouped = (tab: TabLike) => tab.groupId !== undefined && tab.groupId !== -1;

export const groupTitle = (group?: Pick<GroupLike, 'title'>) => group?.title?.trim() || 'Unnamed group';

export function toGroupColor(color: string | undefined): TabGroupColor {
  return TAB_GROUP_COLORS.find((c) => c === color) ?? 'grey';
}

/** A collection made from a browser tab group, remembering its color. */
export function collectionFromGroup(group: GroupLike | undefined, tabs: TabLike[]): Collection | null {
  const cards = tabs.flatMap((tab) => cardFromTab(tab) ?? []);
  if (cards.length === 0) return null;
  return createCollection(groupTitle(group), cards, { tabGroup: { color: toGroupColor(group?.color) } });
}

/**
 * Splits a window's tabs into collections: one per tab group, plus one for
 * ungrouped tabs, in tab-strip order. Returns the tabs that were saved.
 */
export function collectionsFromWindow(tabs: TabLike[], groups: GroupLike[]) {
  const buckets = new Map<number, TabLike[]>();
  for (const tab of tabs) {
    const key = isGrouped(tab) ? tab.groupId! : -1;
    buckets.set(key, [...(buckets.get(key) ?? []), tab]);
  }
  const collections: Collection[] = [];
  const savedTabs: TabLike[] = [];
  for (const [groupId, bucket] of buckets) {
    const collection =
      groupId === -1
        ? createCollection(sessionTitle(), bucket.flatMap((tab) => cardFromTab(tab) ?? []))
        : collectionFromGroup(
            groups.find((g) => g.id === groupId),
            bucket,
          );
    if (!collection || collection.cards.length === 0) continue;
    collections.push(collection);
    savedTabs.push(...bucket.filter((tab) => cardFromTab(tab)));
  }
  return { collections, savedTabs };
}

/** Inserts several collections at the top, keeping their order. */
export const insertCollections =
  (collections: Collection[]): Op =>
  (root) => ({ ...root, collections: [...collections, ...root.collections] });

export function sessionTitle(date = new Date()): string {
  return `Session · ${date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;
}

export function findCard(root: Root, cardId: string) {
  for (const collection of root.collections) {
    const index = collection.cards.findIndex((c) => c.id === cardId);
    const card = collection.cards[index];
    if (card) return { collection, card, index };
  }
  return null;
}

export function collectionIndex(root: Root, collectionId: string): number {
  return root.collections.findIndex((c) => c.id === collectionId);
}

export function allTags(root: Root): string[] {
  const tags = new Set<string>();
  for (const collection of root.collections) {
    for (const card of collection.cards) card.tags.forEach((t) => tags.add(t));
  }
  return [...tags].sort();
}

function clamp(index: number, length: number): number {
  return Math.max(0, Math.min(index, length));
}

function mapCollection(root: Root, collectionId: string, fn: (c: Collection) => Collection): Root {
  return {
    ...root,
    collections: root.collections.map((c) =>
      c.id === collectionId ? { ...fn(c), updatedAt: Date.now() } : c,
    ),
  };
}

// --- collection ops ---

export const insertCollection =
  (collection: Collection, index = 0): Op =>
  (root) => {
    const collections = [...root.collections];
    collections.splice(clamp(index, collections.length), 0, collection);
    return { ...root, collections };
  };

export const renameCollection =
  (collectionId: string, title: string): Op =>
  (root) =>
    mapCollection(root, collectionId, (c) => ({ ...c, title }));

export const setCollapsed =
  (collectionId: string, collapsed: boolean): Op =>
  (root) =>
    mapCollection(root, collectionId, (c) => ({ ...c, collapsed }));

export const deleteCollection =
  (collectionId: string): Op =>
  (root) => ({ ...root, collections: root.collections.filter((c) => c.id !== collectionId) });

export const moveCollection =
  (collectionId: string, toIndex: number): Op =>
  (root) => {
    const from = collectionIndex(root, collectionId);
    if (from === -1) return root;
    const collections = [...root.collections];
    const [moved] = collections.splice(from, 1);
    if (!moved) return root;
    collections.splice(clamp(toIndex, collections.length), 0, moved);
    return { ...root, collections };
  };

// --- card ops ---

export const addCards =
  (collectionId: string, cards: Card[], index?: number): Op =>
  (root) =>
    mapCollection(root, collectionId, (c) => {
      const next = [...c.cards];
      next.splice(clamp(index ?? next.length, next.length), 0, ...cards);
      return { ...c, cards: next };
    });

export const updateCard =
  (cardId: string, patch: Partial<Pick<Card, 'customTitle' | 'note' | 'tags'>>): Op =>
  (root) => {
    const found = findCard(root, cardId);
    if (!found) return root;
    const normalized = patch.tags ? { ...patch, tags: normalizeTags(patch.tags) } : patch;
    return mapCollection(root, found.collection.id, (c) => ({
      ...c,
      cards: c.cards.map((card) => (card.id === cardId ? { ...card, ...normalized } : card)),
    }));
  };

export const deleteCard =
  (cardId: string): Op =>
  (root) => {
    const found = findCard(root, cardId);
    if (!found) return root;
    return mapCollection(root, found.collection.id, (c) => ({
      ...c,
      cards: c.cards.filter((card) => card.id !== cardId),
    }));
  };

/**
 * Moves a card to `toIndex` in the target collection. Within the same
 * collection this has array-move semantics (the card ends up at `toIndex`).
 */
export const moveCard =
  (cardId: string, toCollectionId: string, toIndex: number): Op =>
  (root) => {
    const found = findCard(root, cardId);
    if (!found || collectionIndex(root, toCollectionId) === -1) return root;
    const removed = deleteCard(cardId)(root);
    return addCards(toCollectionId, [found.card], toIndex)(removed);
  };

/** Appends collections from an import, giving everything fresh ids to avoid collisions. */
export const appendCollections =
  (collections: Collection[]): Op =>
  (root) => ({
    ...root,
    collections: [
      ...root.collections,
      ...collections.map((c) => ({
        ...c,
        id: newId(),
        cards: c.cards.map((card) => ({ ...card, id: newId() })),
      })),
    ],
  });
