export interface Card {
  id: string;
  url: string;
  /** Page title captured when the card was saved. */
  title: string;
  /** User-edited title; shown instead of `title` when set. */
  customTitle?: string;
  note?: string;
  tags: string[];
  favIconUrl?: string;
  createdAt: number;
}

export const TAB_GROUP_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'] as const;
export type TabGroupColor = (typeof TAB_GROUP_COLORS)[number];

export interface Collection {
  id: string;
  title: string;
  cards: Card[];
  collapsed: boolean;
  /** Set when saved from a browser tab group, so reopening recreates the group. */
  tabGroup?: { color: TabGroupColor };
  createdAt: number;
  updatedAt: number;
}

export interface Root {
  schemaVersion: 1;
  /** Ordered as displayed on the dashboard. */
  collections: Collection[];
}

export interface Settings {
  closeAfterSave: boolean;
}

/** Minimal tab shape needed to make a card, so callers don't depend on browser types. */
export interface TabLike {
  id?: number;
  url?: string;
  title?: string;
  favIconUrl?: string;
  /** Browser tab group id; -1 or undefined when ungrouped. */
  groupId?: number;
}

/** Minimal browser tab group shape. */
export interface GroupLike {
  id: number;
  title?: string;
  color: string;
}

export type Op = (root: Root) => Root;
