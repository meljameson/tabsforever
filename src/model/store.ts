import { create } from 'zustand';
import { DEFAULT_SETTINGS, mutate, rootItem, settingsItem } from '../storage/db';
import { emptyRoot } from './ops';
import type { Op, Root, Settings } from './types';

export interface Toast {
  id: number;
  message: string;
  undo?: Op;
}

interface State {
  root: Root;
  loaded: boolean;
  settings: Settings;
  query: string;
  activeTags: string[];
  /** Dashboard shows the duplicate-links view instead of collections. */
  showDuplicates: boolean;
  toast: Toast | null;
  /** Collection whose title should open in edit mode (e.g. right after creation). */
  renameRequest: string | null;

  init: () => () => void;
  /** Applies an op locally right away (for snappy drag and drop), then persists it. */
  apply: (op: Op) => Promise<void>;
  setSettings: (patch: Partial<Settings>) => void;
  setQuery: (query: string) => void;
  toggleTag: (tag: string) => void;
  clearFilter: () => void;
  setShowDuplicates: (show: boolean) => void;
  showToast: (message: string, undo?: Op) => void;
  dismissToast: () => void;
  requestRename: (collectionId: string | null) => void;
}

let toastSeq = 0;

export const useStore = create<State>((set, get) => ({
  root: emptyRoot(),
  loaded: false,
  settings: DEFAULT_SETTINGS,
  showDuplicates: false,
  query: '',
  activeTags: [],
  toast: null,
  renameRequest: null,

  init: () => {
    void Promise.all([rootItem.getValue(), settingsItem.getValue()]).then(([root, settings]) =>
      set({ root, settings, loaded: true }),
    );
    // Picks up writes from the background script and other dashboard tabs.
    const unwatchRoot = rootItem.watch((root) => set({ root }));
    const unwatchSettings = settingsItem.watch((settings) => set({ settings }));
    return () => {
      unwatchRoot();
      unwatchSettings();
    };
  },

  apply: async (op) => {
    set({ root: op(get().root) });
    try {
      set({ root: await mutate(op) });
    } catch (err) {
      console.error('Failed to save', err);
      set({ root: await rootItem.getValue() });
      get().showToast('Could not save that change.');
    }
  },

  setSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    void settingsItem.setValue(settings);
  },

  setQuery: (query) => set({ query }),
  toggleTag: (tag) => {
    const { activeTags } = get();
    set({
      activeTags: activeTags.includes(tag) ? activeTags.filter((t) => t !== tag) : [...activeTags, tag],
    });
  },
  clearFilter: () => set({ query: '', activeTags: [], showDuplicates: false }),
  setShowDuplicates: (showDuplicates) => set({ showDuplicates }),

  showToast: (message, undo) => set({ toast: { id: ++toastSeq, message, undo } }),
  dismissToast: () => set({ toast: null }),
  requestRename: (renameRequest) => set({ renameRequest }),
}));
