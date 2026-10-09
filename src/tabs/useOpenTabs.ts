import { useEffect, useState } from 'react';
import { browser, type Browser } from 'wxt/browser';
import { isOpenable } from '../model/ops';
import type { GroupLike } from '../model/types';
import { queryGroups } from './groups';

export type Tab = Browser.tabs.Tab;

interface Listenable {
  addListener(cb: () => void): void;
  removeListener(cb: () => void): void;
}

/** Live list of saveable tabs (and their tab groups) in the window this dashboard is shown in. */
export function useOpenTabs(): { tabs: Tab[]; groups: GroupLike[] } {
  const [state, setState] = useState<{ tabs: Tab[]; groups: GroupLike[] }>({ tabs: [], groups: [] });

  useEffect(() => {
    let cancelled = false;
    let windowId: number | undefined;

    const refresh = async () => {
      windowId ??= (await browser.windows.getCurrent()).id;
      const [all, groups] = await Promise.all([browser.tabs.query({ windowId }), queryGroups(windowId)]);
      if (!cancelled) setState({ tabs: all.filter((t) => t.url && isOpenable(t.url)), groups });
    };

    // Coalesce bursts of tab events (e.g. a page load fires many onUpdated).
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 50);
    };

    const tabGroups = browser.tabGroups;
    const events = [
      browser.tabs.onCreated,
      browser.tabs.onRemoved,
      browser.tabs.onUpdated,
      browser.tabs.onMoved,
      browser.tabs.onAttached,
      browser.tabs.onDetached,
      browser.tabs.onReplaced,
      ...(tabGroups ? [tabGroups.onCreated, tabGroups.onUpdated, tabGroups.onRemoved, tabGroups.onMoved] : []),
    ] as Listenable[];
    events.forEach((e) => e.addListener(schedule));
    void refresh();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      events.forEach((e) => e.removeListener(schedule));
    };
  }, []);

  return state;
}
