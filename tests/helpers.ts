import { createCard, createCollection, emptyRoot, insertCollection } from '../src/model/ops';
import type { Root } from '../src/model/types';

export const card = (url: string, extra: Partial<Parameters<typeof createCard>[0]> = {}) =>
  createCard({ url, title: url, ...extra });

/** Builds a root from { title: [urls] } in display order. */
export function rootOf(spec: Record<string, string[]>): Root {
  return Object.entries(spec)
    .reverse()
    .reduce(
      (root, [title, urls]) => insertCollection(createCollection(title, urls.map((u) => card(u))))(root),
      emptyRoot(),
    );
}

export const titles = (root: Root) => root.collections.map((c) => c.title);
export const urls = (root: Root, index = 0) => root.collections[index]!.cards.map((c) => c.url);
