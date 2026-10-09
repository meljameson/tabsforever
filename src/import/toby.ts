// Toby export → collections. Toby exports look like
//   { "version": 3, "lists": [{ "title": "...", "cards": [{ "title", "url", "customTitle", "customDescription" }] }] }
// Some exports nest lists under spaces/groups; those are flattened as "Space / List".
// Unknown fields are ignored and cards without a usable URL are skipped.
import { createCard, createCollection } from '../model/ops';
import type { Collection } from '../model/types';

export interface ImportResult {
  collections: Collection[];
  cardCount: number;
  skipped: number;
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/** Collects [prefix, list] pairs from any of the shapes Toby has used. */
function findLists(data: unknown, prefix = ''): [string, Obj][] {
  if (Array.isArray(data)) return data.filter(isObj).map((list) => [prefix, list]);
  if (!isObj(data)) return [];
  const lists: [string, Obj][] = [];
  if (Array.isArray(data.lists)) lists.push(...findLists(data.lists, prefix));
  for (const key of ['groups', 'spaces', 'organizations']) {
    const nested = data[key];
    if (!Array.isArray(nested)) continue;
    for (const group of nested.filter(isObj)) {
      const name = str(group.name) || str(group.title);
      lists.push(...findLists(group, prefix && name ? `${prefix} / ${name}` : prefix || name));
    }
  }
  return lists;
}

export function looksLikeToby(data: unknown): boolean {
  return findLists(data).some(([, list]) => Array.isArray(list.cards));
}

export function parseToby(data: unknown): ImportResult {
  let cardCount = 0;
  let skipped = 0;
  const collections = findLists(data).map(([prefix, list]) => {
    const title = str(list.title) || str(list.name) || 'Untitled';
    const rawCards = Array.isArray(list.cards) ? list.cards : [];
    const cards = rawCards.flatMap((raw) => {
      const url = isObj(raw) ? str(raw.url) : '';
      if (!isObj(raw) || !isValidUrl(url)) {
        skipped++;
        return [];
      }
      cardCount++;
      return [
        createCard({
          url,
          title: str(raw.title),
          customTitle: str(raw.customTitle) || undefined,
          note: str(raw.customDescription) || undefined,
        }),
      ];
    });
    return createCollection(prefix ? `${prefix} / ${title}` : title, cards);
  });
  return { collections, cardCount, skipped };
}
