import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createCollection, insertCollection, renameCollection } from '../src/model/ops';
import { mutate, rootItem } from '../src/storage/db';

describe('db', () => {
  beforeEach(() => fakeBrowser.reset());

  it('starts empty', async () => {
    expect(await rootItem.getValue()).toEqual({ schemaVersion: 1, collections: [] });
  });

  it('serializes concurrent mutations so none are lost', async () => {
    const a = createCollection('A');
    await Promise.all([
      mutate(insertCollection(a)),
      mutate(insertCollection(createCollection('B'))),
      mutate(renameCollection(a.id, 'A2')),
    ]);
    const root = await rootItem.getValue();
    expect(root.collections.map((c) => c.title)).toEqual(['B', 'A2']);
  });
});
