import { describe, expect, it } from 'vitest';
import { updateCard } from '../src/model/ops';
import { filterCollections } from '../src/search';
import { rootOf } from './helpers';

describe('filterCollections', () => {
  const base = rootOf({
    Recipes: ['https://cooking.example.com/pasta', 'https://cooking.example.com/soup'],
    Work: ['https://github.com/acme/api', 'https://linear.app/acme'],
  });
  const github = base.collections[1]!.cards[0]!;
  const root = updateCard(github.id, { note: 'Pull requests to review', tags: ['urgent'] })(base);

  it('returns everything when not filtering', () => {
    expect(filterCollections(root, { query: '  ', tags: [] })).toBe(root.collections);
  });

  it('matches cards by url and note, dropping empty collections', () => {
    const byUrl = filterCollections(root, { query: 'linear', tags: [] });
    expect(byUrl.map((c) => c.title)).toEqual(['Work']);
    expect(byUrl[0]!.cards.map((c) => c.url)).toEqual(['https://linear.app/acme']);

    const byNote = filterCollections(root, { query: 'pull requests', tags: [] });
    expect(byNote[0]!.cards.map((c) => c.id)).toEqual([github.id]);
  });

  it('keeps all cards of a collection whose title matches', () => {
    const result = filterCollections(root, { query: 'recipes', tags: [] });
    expect(result.map((c) => c.title)).toEqual(['Recipes']);
    expect(result[0]!.cards).toHaveLength(2);
  });

  it('filters by tag, combined with the query', () => {
    expect(filterCollections(root, { query: '', tags: ['urgent'] })[0]!.cards.map((c) => c.id)).toEqual([github.id]);
    expect(filterCollections(root, { query: 'pasta', tags: ['urgent'] })).toEqual([]);
  });
});
