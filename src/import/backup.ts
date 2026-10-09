// tabsforever's own export format: a versioned wrapper around the collections.
import { createCollection, newId, normalizeTags } from '../model/ops';
import type { Card, Collection, Root } from '../model/types';
import { looksLikeToby, parseToby, type ImportResult } from './toby';

const FORMAT = 'tabsforever';

export interface Backup {
  format: typeof FORMAT;
  schemaVersion: 1;
  exportedAt: string;
  collections: Collection[];
}

export function toBackup(root: Root, now = new Date()): Backup {
  return { format: FORMAT, schemaVersion: 1, exportedAt: now.toISOString(), collections: root.collections };
}

export function backupFilename(now = new Date()): string {
  return `tabsforever-${now.toISOString().slice(0, 10)}.json`;
}

function isBackup(data: unknown): data is { format: string; collections: unknown } {
  return typeof data === 'object' && data !== null && (data as { format?: unknown }).format === FORMAT;
}

function parseBackup(data: { collections: unknown }): ImportResult {
  if (!Array.isArray(data.collections)) throw new Error('Backup has no collections.');
  let cardCount = 0;
  let skipped = 0;
  const collections = data.collections.map((raw: Partial<Collection>) => {
    const cards = (Array.isArray(raw.cards) ? raw.cards : []).flatMap((card: Partial<Card>) => {
      if (typeof card?.url !== 'string') {
        skipped++;
        return [];
      }
      cardCount++;
      return [
        {
          title: '',
          createdAt: Date.now(),
          ...card,
          id: typeof card.id === 'string' ? card.id : newId(),
          tags: normalizeTags(Array.isArray(card.tags) ? card.tags : []),
        } as Card,
      ];
    });
    const base = createCollection(String(raw.title ?? 'Untitled'), cards);
    return { ...base, ...raw, id: typeof raw.id === 'string' ? raw.id : base.id, cards } as Collection;
  });
  return { collections, cardCount, skipped };
}

export type ImportSource = 'tabsforever' | 'toby';

/** Detects the file format and parses it. Throws with a readable message on bad input. */
export function parseImport(text: string): ImportResult & { source: ImportSource } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (isBackup(data)) return { ...parseBackup(data), source: 'tabsforever' };
  if (looksLikeToby(data)) return { ...parseToby(data), source: 'toby' };
  throw new Error('Unrecognized file. Expected a tabsforever backup or a Toby export.');
}
