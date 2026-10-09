import { describe, expect, it } from 'vitest';
import {
  allTags,
  appendCollections,
  cardFromTab,
  createCollection,
  deleteCard,
  findCard,
  isOpenable,
  moveCard,
  moveCollection,
  updateCard,
} from '../src/model/ops';
import { card, rootOf, titles, urls } from './helpers';

describe('ops', () => {
  it('moves a card within a collection with array-move semantics', () => {
    const root = rootOf({ A: ['a1', 'a2', 'a3'] });
    const id = root.collections[0]!.cards[0]!.id;
    expect(urls(moveCard(id, root.collections[0]!.id, 2)(root))).toEqual(['a2', 'a3', 'a1']);
  });

  it('moves a card into another collection at an index', () => {
    const root = rootOf({ A: ['a1', 'a2'], B: ['b1', 'b2'] });
    const id = root.collections[0]!.cards[1]!.id;
    const next = moveCard(id, root.collections[1]!.id, 1)(root);
    expect(urls(next, 0)).toEqual(['a1']);
    expect(urls(next, 1)).toEqual(['b1', 'a2', 'b2']);
  });

  it('ignores moves to a missing collection', () => {
    const root = rootOf({ A: ['a1'] });
    expect(moveCard(root.collections[0]!.cards[0]!.id, 'nope', 0)(root)).toBe(root);
  });

  it('reorders collections', () => {
    const root = rootOf({ A: [], B: [], C: [] });
    expect(titles(moveCollection(root.collections[0]!.id, 2)(root))).toEqual(['B', 'C', 'A']);
  });

  it('does not mutate the input root', () => {
    const root = rootOf({ A: ['a1', 'a2'] });
    const snapshot = structuredClone(root);
    deleteCard(root.collections[0]!.cards[0]!.id)(root);
    expect(root).toEqual(snapshot);
  });

  it('normalizes tags on update and collects them', () => {
    const root = rootOf({ A: ['a1'] });
    const id = root.collections[0]!.cards[0]!.id;
    const next = updateCard(id, { tags: [' Work', 'work', '', 'Reading ', ' #later', '##'] })(root);
    expect(findCard(next, id)!.card.tags).toEqual(['work', 'reading', 'later']);
    expect(allTags(next)).toEqual(['later', 'reading', 'work']);
  });

  it('only saves openable tabs', () => {
    expect(cardFromTab({ url: 'https://a.com', title: 'A' })?.title).toBe('A');
    expect(cardFromTab({ url: 'chrome://newtab/' })).toBeNull();
    expect(cardFromTab({ url: 'about:blank' })).toBeNull();
    expect(cardFromTab({})).toBeNull();
    expect(cardFromTab({ url: 'https://a.com', favIconUrl: 'data:' + 'x'.repeat(30_000) })?.favIconUrl).toBe(
      undefined,
    );
    expect(isOpenable('moz-extension://abc/newtab.html')).toBe(false);
  });

  it('gives appended collections fresh ids', () => {
    const imported = createCollection('I', [card('https://x.com')]);
    const next = appendCollections([imported])(rootOf({ A: [] }));
    expect(titles(next)).toEqual(['A', 'I']);
    expect(next.collections[1]!.id).not.toBe(imported.id);
    expect(next.collections[1]!.cards[0]!.id).not.toBe(imported.cards[0]!.id);
  });
});
