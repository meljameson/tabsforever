import { describe, expect, it } from 'vitest';
import { dropOp } from '../src/model/drop';
import { card, rootOf, titles, urls } from './helpers';

describe('dropOp', () => {
  const root = rootOf({ A: ['https://a1.com', 'https://a2.com'], B: ['https://b1.com'] });
  const [A, B] = root.collections as [(typeof root.collections)[0], (typeof root.collections)[0]];
  const tab = { type: 'tab', tab: { id: 7, url: 'https://new.com', title: 'New' } } as const;

  it('inserts a dropped tab before the card it lands on', () => {
    const next = dropOp(root, tab, { type: 'card', cardId: A.cards[1]!.id })!(root);
    expect(urls(next, 0)).toEqual(['https://a1.com', 'https://new.com', 'https://a2.com']);
  });

  it('appends a tab dropped on a collection body', () => {
    const next = dropOp(root, tab, { type: 'collection-body', collectionId: B.id })!(root);
    expect(urls(next, 1)).toEqual(['https://b1.com', 'https://new.com']);
  });

  it('creates a new collection named after the tab', () => {
    const next = dropOp(root, tab, { type: 'new-collection' })!(root);
    expect(titles(next)).toEqual(['New', 'A', 'B']);
    expect(urls(next, 0)).toEqual(['https://new.com']);
  });

  it('ignores unsaveable tabs', () => {
    expect(dropOp(root, { type: 'tab', tab: { url: 'about:config' } }, { type: 'new-collection' })).toBeNull();
  });

  it('moves a card to another collection', () => {
    const next = dropOp(root, { type: 'card', cardId: A.cards[0]!.id }, { type: 'card', cardId: B.cards[0]!.id })!(
      root,
    );
    expect(urls(next, 0)).toEqual(['https://a2.com']);
    expect(urls(next, 1)).toEqual(['https://a1.com', 'https://b1.com']);
  });

  it('moves a card out into a new collection', () => {
    const next = dropOp(root, { type: 'card', cardId: B.cards[0]!.id }, { type: 'new-collection' })!(root);
    expect(titles(next)).toEqual(['https://b1.com', 'A', 'B']);
    expect(urls(next, 2)).toEqual([]);
  });

  it('reorders collections and ignores no-op drops', () => {
    const drag = { type: 'collection', collectionId: A.id } as const;
    expect(titles(dropOp(root, drag, { type: 'collection', collectionId: B.id })!(root))).toEqual(['B', 'A']);
    expect(dropOp(root, drag, { type: 'collection', collectionId: A.id })).toBeNull();
    expect(dropOp(root, drag, { type: 'card', cardId: B.cards[0]!.id })).toBeNull();
    expect(dropOp(root, { type: 'card', cardId: A.cards[0]!.id }, { type: 'card', cardId: A.cards[0]!.id })).toBeNull();
  });

  it('keeps card fields when moving', () => {
    const tagged = rootOf({ A: [] });
    const c = card('https://t.com', { note: 'hi', tags: ['x'] });
    tagged.collections[0]!.cards.push(c);
    const next = dropOp(tagged, { type: 'card', cardId: c.id }, { type: 'new-collection' })!(tagged);
    expect(next.collections[0]!.cards[0]).toEqual(c);
  });
});
