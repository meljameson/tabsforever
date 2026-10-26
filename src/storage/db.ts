import { storage } from 'wxt/utils/storage';
import { emptyRoot } from '../model/ops';
import type { Op, Root, Settings } from '../model/types';

// Everything lives under one key so each write is atomic. When the shape
// changes, bump `version` and add an entry to `migrations`.
export const rootItem = storage.defineItem<Root>('local:root', {
  init: emptyRoot,
  version: 1,
});

export const DEFAULT_SETTINGS: Settings = { closeAfterSave: false, collectionSort: 'manual' };

const settingsStore = storage.defineItem<Partial<Settings>>('local:settings', { fallback: {} });

/** Settings with defaults filled in, so new fields work for existing installs. */
export const settingsItem = {
  getValue: async (): Promise<Settings> => ({ ...DEFAULT_SETTINGS, ...(await settingsStore.getValue()) }),
  setValue: (settings: Settings) => settingsStore.setValue(settings),
  watch: (cb: (settings: Settings) => void) =>
    settingsStore.watch((value) => cb({ ...DEFAULT_SETTINGS, ...value })),
};

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
