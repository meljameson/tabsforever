import { storage } from 'wxt/utils/storage';
import { emptyRoot } from '../model/ops';
import type { Op, Root, Settings } from '../model/types';

// Everything lives under one key so each write is atomic. When the shape
// changes, bump `version` and add an entry to `migrations`.
export const rootItem = storage.defineItem<Root>('local:root', {
  init: emptyRoot,
  version: 1,
});

export const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: { closeAfterSave: false },
});

let queue: Promise<unknown> = Promise.resolve();

/**
 * Applies an op to the latest stored root. Writes from the same context are
 * serialized so concurrent ops never read stale data.
 */
export function mutate(op: Op): Promise<Root> {
  const next = queue.then(async () => {
    const root = op(await rootItem.getValue());
    await rootItem.setValue(root);
    return root;
  });
  queue = next.catch(() => undefined);
  return next;
}
