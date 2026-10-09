import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseImport, toBackup } from '../src/import/backup';
import { parseToby } from '../src/import/toby';
import { rootOf } from './helpers';

const fixture = readFileSync(new URL('./fixtures/toby-export.json', import.meta.url), 'utf8');

describe('Toby import', () => {
  it('maps lists to collections and cards to links', () => {
    const result = parseImport(fixture);
    expect(result.source).toBe('toby');
    expect(result.collections.map((c) => c.title)).toEqual(['Dev', 'Empty list', 'Untitled-ish', 'Team space / Shared']);
    expect(result.cardCount).toBe(4);
    expect(result.skipped).toBe(2);

    const mdn = result.collections[0]!.cards[1]!;
    expect(mdn).toMatchObject({
      url: 'https://developer.mozilla.org/en-US/',
      title: 'MDN Web Docs',
      customTitle: 'MDN',
      note: 'Reference for everything web',
      tags: [],
    });
    // Empty custom fields don't become empty strings.
    expect(result.collections[0]!.cards[0]!.customTitle).toBeUndefined();
    expect(result.collections[0]!.cards[0]!.note).toBeUndefined();
  });

  it('accepts a bare array of lists', () => {
    const result = parseToby([{ title: 'X', cards: [{ url: 'https://x.com' }] }]);
    expect(result.collections).toHaveLength(1);
    expect(result.cardCount).toBe(1);
  });
});

describe('backup', () => {
  it('round-trips through export and import', () => {
    const root = rootOf({ A: ['https://a.com'], B: [] });
    const result = parseImport(JSON.stringify(toBackup(root)));
    expect(result.source).toBe('tabsforever');
    expect(result.collections).toEqual(root.collections);
  });

  it('fills in missing ids and tags', () => {
    const result = parseImport(
      JSON.stringify({ format: 'tabsforever', collections: [{ title: 'T', cards: [{ url: 'https://x.com' }, {}] }] }),
    );
    const c = result.collections[0]!;
    expect(c.id).toEqual(expect.any(String));
    expect(c.cards[0]).toMatchObject({ id: expect.any(String), tags: [], title: '' });
    expect(result.skipped).toBe(1);
  });

  it('rejects bad input with a readable error', () => {
    expect(() => parseImport('{nope')).toThrow('not valid JSON');
    expect(() => parseImport('{"hello": 1}')).toThrow('Unrecognized file');
  });
});
