import { browser } from 'wxt/browser';
import type { GroupLike } from '../model/types';

/** Tab groups in a window; empty where the browser has no tabGroups API. */
export async function queryGroups(windowId: number | undefined): Promise<GroupLike[]> {
  try {
    return (await browser.tabGroups?.query({ windowId })) ?? [];
  } catch {
    return [];
  }
}
