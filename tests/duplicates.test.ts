import { describe, expect, it } from 'vitest';
import { dropOp, duplicatesOnDrop, type DragData } from '../src/model/drop';
import { addCards, collectionFromGroup, collectionsFromWindow, moveCard } from '../src/model/ops';
import { card, rootOf, urls } from './helpers';

describe('duplicate links', () => {
  const root = rootOf({ A: ['https://a.com/', 'https://b.com/'], B: ['https://c.com/'] });
  const [A, B] = [root.collections[0]!, root.collections[1]!];
  const tab = (url: string): DragData => ({ type: 'tab', tab: { id: 1, url, title: url } });

  it('addCards skips links already in the collection, and repeats within the batch', () => {
    const next = addCards(A.id, [card('https://a.com'), card('https://d.com'), card('https://d.com/')])(root);
    expect(urls(next)).toEqual(['https://a.com/', 'https://b.com/', 'https://d.com']);
  });

  it('treats a bare trailing # as the same link but keeps real fragments distinct', () => {
    const next = addCards(A.id, [card('https://a.com/#'), card('https://a.com/#/inbox')])(root);
    expect(urls(next)).toEqual(['https://a.com/', 'https://b.com/', 'https://a.com/#/inbox']);
  });

  it('refuses a tab drop that is already in the target, and reports it', () => {
    const drop = { type: 'collection-body', collectionId: A.id } as const;
    expect(dropOp(root, tab('https://a.com'), drop)).toBeNull();
    expect(duplicatesOnDrop(root, tab('https://a.com'), drop)).toMatchObject({ collection: { id: A.id }, count: 1 });
    // The same link is fine in a different collection.
    expect(dropOp(root, tab('https://a.com'), { type: 'collection-body', collectionId: B.id })).not.toBeNull();
    expect(duplicatesOnDrop(root, tab('https://a.com'), { type: 'new-collection' })).toBeNull();
  });

  it('adds only the new tabs of a group, counting the skipped ones', () => {
    const drag: DragData = {
      type: 'group',
      group: { id: 1, title: 'G', color: 'blue' },
      tabs: [{ url: 'https://a.com/' }, { url: 'https://z.com/' }],
    };
    const drop = { type: 'collection-body', collectionId: A.id } as const;
    expect(duplicatesOnDrop(root, drag, drop)?.count).toBe(1);
    expect(urls(dropOp(root, drag, drop)!(root))).toEqual(['https://a.com/', 'https://b.com/', 'https://z.com/']);
  });

  it('will not move a card into a collection that already has its link', () => {
    const withDup = addCards(B.id, [card('https://a.com/')])(root);
    const cardId = withDup.collections[0]!.cards[0]!.id;
    const B2 = withDup.collections[1]!;
    expect(moveCard(cardId, B2.id, 0)(withDup)).toBe(withDup);
    expect(dropOp(withDup, { type: 'card', cardId }, { type: 'collection-body', collectionId: B2.id })).toBeNull();
    // Reordering within its own collection is unaffected.
    expect(duplicatesOnDrop(withDup, { type: 'card', cardId }, { type: 'collection-body', collectionId: A.id })).toBeNull();
    expect(urls(moveCard(cardId, A.id, 1)(withDup))).toEqual(['https://b.com/', 'https://a.com/']);
  });

  it('dedupes repeated tabs when saving a group or window', () => {
    const tabs = [{ url: 'https://x.com/' }, { url: 'https://x.com/' }, { url: 'https://y.com/' }];
    expect(collectionFromGroup({ id: 1, color: 'red' }, tabs)!.cards).toHaveLength(2);
    expect(collectionsFromWindow(tabs, []).collections[0]!.cards).toHaveLength(2);
  });
});
