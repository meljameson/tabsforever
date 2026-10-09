import { browser, type Browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import {
  addCards,
  cardFromTab,
  collectionFromGroup,
  collectionsFromWindow,
  createCollection,
  insertCollection,
  insertCollections,
  isGrouped,
} from '../src/model/ops';
import type { Card, Root, TabLike } from '../src/model/types';
import { mutate, rootItem, settingsItem } from '../src/storage/db';
import { queryGroups } from '../src/tabs/groups';

const MENU_ROOT = 'save-tab';
const MENU_NEW = 'save-tab:new';
const MENU_WINDOW = 'save-window';
const MENU_GROUP = 'save-group';
const MENU_COLLECTION_PREFIX = 'save-tab:collection:';
/** Most recently updated collections offered in the "Save tab to…" submenu. */
const MENU_COLLECTION_LIMIT = 15;

// Firefox has a dedicated "tab" context (the tab strip); Chrome rejects it.
const contexts = (
  import.meta.env.FIREFOX ? ['page', 'tab'] : ['page']
) as Browser.contextMenus.CreateProperties['contexts'];

function createMenu(props: Browser.contextMenus.CreateProperties) {
  browser.contextMenus.create({ contexts, ...props }, () => void browser.runtime.lastError);
}

let menuQueue: Promise<void> = Promise.resolve();

/** Rebuilds the context menus so the collection submenu matches stored data. */
function rebuildMenus(root: Root) {
  menuQueue = menuQueue.then(async () => {
    await browser.contextMenus.removeAll();
    createMenu({ id: MENU_ROOT, title: 'Save tab to tabsforever' });
    createMenu({ id: MENU_NEW, parentId: MENU_ROOT, title: 'New collection' });
    const recent = [...root.collections]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MENU_COLLECTION_LIMIT);
    if (recent.length > 0) {
      createMenu({ id: 'save-tab:sep', parentId: MENU_ROOT, type: 'separator' });
      for (const collection of recent) {
        createMenu({
          id: MENU_COLLECTION_PREFIX + collection.id,
          parentId: MENU_ROOT,
          title: collection.title.replaceAll('&', '&&'),
        });
      }
    }
    if (browser.tabGroups) createMenu({ id: MENU_GROUP, title: "Save this tab's group" });
    createMenu({ id: MENU_WINDOW, title: 'Save all tabs in this window' });
  });
}

async function closeSaved(tabs: TabLike[], windowId: number) {
  if (!(await settingsItem.getValue()).closeAfterSave) return;
  const ids = tabs.flatMap((t) => (t.id === undefined ? [] : [t.id]));
  const remaining = await browser.tabs.query({ windowId });
  // Open the dashboard first if closing would otherwise close the window.
  if (remaining.length <= ids.length) await browser.tabs.create({ windowId });
  await browser.tabs.remove(ids);
}

/** Saves a window's tabs: one collection per tab group, plus one for ungrouped tabs. */
async function saveWindow(windowId: number) {
  const [tabs, groups] = await Promise.all([browser.tabs.query({ windowId }), queryGroups(windowId)]);
  const { collections, savedTabs } = collectionsFromWindow(tabs, groups);
  if (collections.length === 0) return;
  await mutate(insertCollections(collections));
  await closeSaved(savedTabs, windowId);
}

/** Saves the tab group the given tab belongs to (or just the tab, if ungrouped). */
async function saveGroup(tab: Browser.tabs.Tab) {
  if (!isGrouped(tab)) return saveTab(tab);
  const [tabs, group] = await Promise.all([
    browser.tabs.query({ windowId: tab.windowId }),
    browser.tabGroups.get(tab.groupId).catch(() => undefined),
  ]);
  const members = tabs.filter((t) => t.groupId === tab.groupId);
  const collection = collectionFromGroup(group, members);
  if (!collection) return;
  await mutate(insertCollection(collection));
  await closeSaved(members, tab.windowId);
}

async function saveTab(tab: Browser.tabs.Tab, collectionId?: string) {
  const card: Card | null = cardFromTab(tab);
  if (!card) return;
  await mutate(
    collectionId
      ? addCards(collectionId, [card])
      : insertCollection(createCollection(card.title || 'New collection', [card])),
  );
  await closeSaved([tab], tab.windowId);
}

interface FirefoxMenus {
  onShown: { addListener(cb: (info: unknown, tab?: Browser.tabs.Tab) => void): void };
  refresh(): Promise<void>;
}

export default defineBackground(() => {
  // Listeners are registered synchronously so the MV3 service worker
  // receives the event that woke it up.
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab) return;
    const id = String(info.menuItemId);
    if (id === MENU_WINDOW && tab.windowId !== undefined) void saveWindow(tab.windowId);
    else if (id === MENU_GROUP) void saveGroup(tab);
    else if (id === MENU_NEW) void saveTab(tab);
    else if (id.startsWith(MENU_COLLECTION_PREFIX)) void saveTab(tab, id.slice(MENU_COLLECTION_PREFIX.length));
  });

  (browser.action ?? browser.browserAction).onClicked.addListener((tab) => {
    if (tab.windowId !== undefined) void saveWindow(tab.windowId);
  });

  // Firefox can hide the group item on ungrouped tabs; Chrome has no onShown,
  // so there it falls back to saving just the tab.
  const menus = (browser as unknown as { menus?: FirefoxMenus }).menus;
  menus?.onShown.addListener((_info, tab) => {
    void browser.contextMenus.update(MENU_GROUP, { visible: !!tab && isGrouped(tab) }).then(() => menus.refresh());
  });

  rootItem.watch((root) => rebuildMenus(root));
  void rootItem.getValue().then(rebuildMenus);
});
