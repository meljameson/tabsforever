import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { duplicateCardIds, findDuplicates, keepOnly } from '../src/model/duplicates';
import { updateCard } from '../src/model/ops';
import { sortCollections } from '../src/model/sort';
import type { Root } from '../src/model/types';
import { settingsItem } from '../src/storage/db';
import { card, rootOf, titles, urls } from './helpers';

/** Cross-collection duplicates, plus a legacy within-collection duplicate. */
function sample(): Root {
  const root = rootOf({
    A: ['https://x.com/', 'https://y.com/'],
    B: ['https://z.com/', 'https://x.com/#'],
    C: ['https://y.com/', 'https://w.com/'],
  });
  // Simulate a pre-dedupe duplicate inside C (bypassing addCards).
  root.collections[2]!.cards.push(card('https://y.com/'));
  return root;
}

describe('findDuplicates', () => {
  it('groups copies across and within collections, in dashboard order', () => {
    const groups = findDuplicates(sample());
    expect(groups.map((g) => g.key)).toEqual(['https://x.com/', 'https://y.com/']);
    expect(groups[1]!.copies.map((c) => [c.collection.title, c.index])).toEqual([['A', 1], ['C', 0], ['C', 2]]);
    expect(duplicateCardIds(sample()).size).toBe(5);
    expect(findDuplicates(rootOf({ A: ['https://a.com/'] }))).toEqual([]);
  });
});

describe('keepOnly', () => {
  it('removes the other copies, merging tags and a missing note', () => {
    let root = sample();
    const [a, b] = [root.collections[0]!, root.collections[1]!];
    root = updateCard(b.cards[1]!.id, { tags: ['read'], note: 'from B' })(root);
    root = updateCard(a.cards[0]!.id, { tags: ['work'] })(root);

    const result = keepOnly(root, a.cards[0]!.id)!;
    expect(result.removed).toBe(1);
    const next = result.op(root);
    expect(urls(next, 1)).toEqual(['https://z.com/']);
    expect(next.collections[0]!.cards[0]).toMatchObject({ tags: ['work', 'read'], note: 'from B' });
  });

  it('undo restores the exact previous state, including legacy duplicates', () => {
    const root = sample();
    const keepId = root.collections[2]!.cards[2]!.id; // the last of three y.com copies
    const result = keepOnly(root, keepId)!;
    expect(result.removed).toBe(2);
    const next = result.op(root);
    expect(urls(next, 0)).toEqual(['https://x.com/']);
    expect(urls(next, 2)).toEqual(['https://w.com/', 'https://y.com/']);
    expect(result.undo(next).collections.map((c) => c.cards)).toEqual(root.collections.map((c) => c.cards));
  });

  it('returns null when there is nothing to remove', () => {
    const root = sample();
    expect(keepOnly(root, root.collections[1]!.cards[0]!.id)).toBeNull(); // z.com is unique
    expect(keepOnly(root, 'missing')).toBeNull();
  });
});

describe('sortCollections', () => {
  const root = rootOf({ 'b list': ['https://1.com'], 'A list': ['https://1.com', 'https://2.com'], 'list 10': [], 'list 9': [] });
  root.collections.forEach((c, i) => {
    c.createdAt = 100 + i;
    c.updatedAt = 200 - i;
  });
  const sorted = (sort: Parameters<typeof sortCollections>[1]) =>
    titles({ ...root, collections: sortCollections(root.collections, sort) });

  it('sorts by each option without touching stored order', () => {
    expect(sorted('manual')).toEqual(['b list', 'A list', 'list 10', 'list 9']);
    expect(sorted('name')).toEqual(['A list', 'b list', 'list 9', 'list 10']);
    expect(sorted('newest')).toEqual(['list 9', 'list 10', 'A list', 'b list']);
    expect(sorted('updated')).toEqual(['b list', 'A list', 'list 10', 'list 9']);
    expect(sorted('size')).toEqual(['A list', 'b list', 'list 9', 'list 10']);
    expect(titles(root)).toEqual(['b list', 'A list', 'list 10', 'list 9']);
  });
});

describe('settings', () => {
  beforeEach(() => fakeBrowser.reset());
  it('fills new fields for settings saved by older versions', async () => {
    await fakeBrowser.storage.local.set({ settings: { closeAfterSave: true } });
    expect(await settingsItem.getValue()).toEqual({ closeAfterSave: true, collectionSort: 'manual' });
  });
});
