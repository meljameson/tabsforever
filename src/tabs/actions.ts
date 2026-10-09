import { browser } from 'wxt/browser';
import { isOpenable } from '../model/ops';
import type { Card, Collection } from '../model/types';

export async function openCard(card: Card, active = true) {
  if (isOpenable(card.url)) await browser.tabs.create({ url: card.url, active });
}

/** Opens a collection's links; collections saved from a tab group reopen as that group. */
export async function openCollection(collection: Collection, inNewWindow = false) {
  const urls = collection.cards.map((c) => c.url).filter(isOpenable);
  if (urls.length === 0) return;

  let tabIds: number[];
  let windowId: number | undefined;
  if (inNewWindow) {
    const win = await browser.windows.create({ url: urls });
    windowId = win?.id;
    const tabs = win?.tabs ?? (await browser.tabs.query({ windowId }));
    tabIds = tabs.flatMap((t) => (t.id === undefined ? [] : [t.id]));
  } else {
    tabIds = [];
    for (const url of urls) {
      const tab = await browser.tabs.create({ url, active: false });
      if (tab.id !== undefined) tabIds.push(tab.id);
    }
  }

  if (collection.tabGroup) await groupTabs(tabIds, collection.title, collection.tabGroup.color, windowId);
}

async function groupTabs(tabIds: number[], title: string, color: NonNullable<Collection['tabGroup']>['color'], windowId?: number) {
  if (tabIds.length === 0 || !browser.tabs.group) return;
  try {
    const groupId = await browser.tabs.group({
      tabIds: tabIds as [number, ...number[]],
      ...(windowId !== undefined && { createProperties: { windowId } }),
    });
    await browser.tabGroups?.update(groupId, { title, color });
  } catch (err) {
    // Tabs are open either way; grouping is best-effort.
    console.warn('Could not recreate tab group', err);
  }
}

export async function closeTabs(tabIds: (number | undefined)[]) {
  const ids = tabIds.filter((id): id is number => id !== undefined);
  if (ids.length > 0) await browser.tabs.remove(ids);
}
