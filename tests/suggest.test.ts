import { describe, expect, it } from 'vitest';
import { collectionsFromWindow, keepTitle, renameCollection } from '../src/model/ops';
import { suggestName } from '../src/model/suggest';
import { card, rootOf } from './helpers';

const cards = (...pairs: [string, string][]) => pairs.map(([url, title]) => card(url, { title }));

describe('suggestName', () => {
  it('uses a shared theme word, plus the site when one dominates', () => {
    expect(
      suggestName(
        cards(
          ['https://react.dev/learn', 'Quick Start – React'],
          ['https://react.dev/reference/react/useEffect', 'useEffect – React'],
          ['https://stackoverflow.com/q/1', 'reactjs - How to use React hooks with TypeScript - Stack Overflow'],
        ),
      ),
    ).toBe('React');

    expect(
      suggestName(
        cards(
          ['https://github.com/acme/api/pull/12', 'Fix auth refresh by mel · Pull Request #12 · acme/api · GitHub'],
          ['https://github.com/acme/api/pull/15', 'Add rate limits · Pull Request #15 · acme/api · GitHub'],
          ['https://github.com/acme/web/pull/3', 'Dark mode · Pull Request #3 · acme/web · GitHub'],
        ),
      ),
    ).toBe('Pull Request · GitHub');
  });

  it('finds topics across different sites', () => {
    expect(
      suggestName(
        cards(
          ['https://www.lonelyplanet.com/portugal/lisbon', 'Lisbon travel guide'],
          ['https://www.booking.com/city/pt/lisbon.html', 'Hotels in Lisbon, Portugal'],
          ['https://www.tripadvisor.com/Lisbon', 'THE 15 BEST Things to Do in Lisbon - 2026'],
          ['https://maps.google.com/?q=lisbon', 'Google Maps'],
        ),
      ),
    ).toBe('Lisbon');
  });

  it('falls back to the site name, or two sites', () => {
    expect(
      suggestName(
        cards(
          ['https://www.youtube.com/watch?v=1', 'Lofi beats to study to'],
          ['https://www.youtube.com/watch?v=2', 'Building a shed in a weekend'],
          ['https://www.youtube.com/watch?v=3', 'Quantum computing explained'],
        ),
      ),
    ).toBe('YouTube');
    expect(
      suggestName(
        cards(
          ['https://github.com/a/b', 'a/b: tool'],
          ['https://github.com/c/d', 'c/d: other'],
          ['https://stackoverflow.com/q/1', 'Segfault in loop'],
          ['https://stackoverflow.com/q/2', 'Regex lookbehind'],
        ),
      ),
    ).toBe('GitHub & Stack Overflow');
  });

  it('names a single link by the specific part of its title', () => {
    expect(suggestName(cards(['https://developer.mozilla.org/en-US/docs/Web/CSS/grid', 'grid - CSS: Cascading Style Sheets | MDN']))).toBe('grid');
    expect(suggestName(cards(['https://www.youtube.com/watch?v=x', 'YouTube']))).toBe('YouTube');
    expect(suggestName(cards(['https://docs.python.org/3/library/asyncio.html', '']))).toBe('Python');
  });

  it('handles co.uk style domains and gives up on unrelated tabs', () => {
    expect(
      suggestName(
        cards(
          ['https://www.bbc.co.uk/news/1', 'Story one'],
          ['https://www.bbc.co.uk/news/2', 'Story two'],
        ),
      ),
    ).toBe('Story · Bbc');
    expect(
      suggestName(
        cards(
          ['https://a.com', 'Apples'],
          ['https://b.org', 'Bicycles'],
          ['https://c.net', 'Cameras'],
        ),
      ),
    ).toBeNull();
    expect(suggestName([])).toBeNull();
  });

  it('keeps names short', () => {
    const long = 'A'.repeat(80);
    expect(suggestName(cards(['https://x.com/1', long]))!.length).toBeLessThanOrEqual(48);
  });
});

describe('autoTitle', () => {
  it('marks placeholder names and clears on rename or dismiss', () => {
    const { collections } = collectionsFromWindow(
      [
        { id: 1, url: 'https://a.com', groupId: 5 },
        { id: 2, url: 'https://b.com', groupId: 6 },
        { id: 3, url: 'https://c.com' },
      ],
      [{ id: 5, title: 'Work', color: 'blue' }, { id: 6, title: '', color: 'red' }],
    );
    expect(collections.map((c) => c.autoTitle)).toEqual([undefined, true, true]);

    const root = { ...rootOf({}), collections };
    expect(renameCollection(collections[1]!.id, 'Mine')(root).collections[1]!.autoTitle).toBe(false);
    expect(keepTitle(collections[2]!.id)(root).collections[2]).toMatchObject({ autoTitle: false });
  });
});
