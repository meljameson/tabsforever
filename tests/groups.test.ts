import { describe, expect, it } from 'vitest';
import { dropOp, type DragData } from '../src/model/drop';
import { collectionFromGroup, collectionsFromWindow, emptyRoot, toGroupColor } from '../src/model/ops';
import type { TabLike } from '../src/model/types';
import { rootOf, titles, urls } from './helpers';

const tab = (id: number, groupId = -1, url = `https://t${id}.com`): TabLike => ({ id, url, title: `T${id}`, groupId });

describe('tab groups', () => {
  const groups = [
    { id: 10, title: 'Research', color: 'blue' },
    { id: 20, title: '  ', color: 'red' },
  ];

  it('splits a window into one collection per group plus ungrouped tabs, in strip order', () => {
    const tabs = [tab(1, 10), tab(2, 10), tab(3), tab(4, 20), tab(5), tab(6, -1, 'chrome://settings')];
    const { collections, savedTabs } = collectionsFromWindow(tabs, groups);
    expect(collections.map((c) => c.title.startsWith('Session') ? 'Session' : c.title)).toEqual([
      'Research',
      'Session',
      'Unnamed group',
    ]);
    expect(collections.map((c) => c.cards.map((card) => card.title))).toEqual([['T1', 'T2'], ['T3', 'T5'], ['T4']]);
    expect(collections.map((c) => c.tabGroup?.color)).toEqual(['blue', undefined, 'red']);
    expect(savedTabs.map((t) => t.id)).toEqual([1, 2, 3, 5, 4]);
  });

  it('handles groups the browser could not describe and windows with nothing saveable', () => {
    const { collections } = collectionsFromWindow([tab(1, 99)], []);
    expect(collections[0]).toMatchObject({ title: 'Unnamed group', tabGroup: { color: 'grey' } });
    expect(collectionsFromWindow([tab(1, -1, 'about:blank')], []).collections).toEqual([]);
    expect(collectionFromGroup(groups[0], [tab(1, 10, 'about:newtab')])).toBeNull();
  });

  it('falls back to grey for unknown colors', () => {
    expect(toGroupColor('magenta')).toBe('grey');
    expect(toGroupColor('cyan')).toBe('cyan');
  });

  it('drops a whole group into a new collection or an existing one', () => {
    const drag: DragData = { type: 'group', group: groups[0]!, tabs: [tab(1, 10), tab(2, 10)] };
    const fresh = dropOp(emptyRoot(), drag, { type: 'new-collection' })!(emptyRoot());
    expect(titles(fresh)).toEqual(['Research']);
    expect(fresh.collections[0]!.tabGroup).toEqual({ color: 'blue' });

    const root = rootOf({ A: ['https://a.com'] });
    const next = dropOp(root, drag, { type: 'collection-body', collectionId: root.collections[0]!.id })!(root);
    expect(urls(next)).toEqual(['https://a.com', 'https://t1.com', 'https://t2.com']);
  });
});
