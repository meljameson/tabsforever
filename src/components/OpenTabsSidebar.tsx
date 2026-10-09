import { useDraggable } from '@dnd-kit/core';
import { browser } from 'wxt/browser';
import {
  collectionFromGroup,
  collectionsFromWindow,
  groupTitle,
  insertCollection,
  insertCollections,
  isGrouped,
} from '../model/ops';
import { useStore } from '../model/store';
import type { GroupLike, TabLike } from '../model/types';
import { closeTabs } from '../tabs/actions';
import { useOpenTabs, type Tab } from '../tabs/useOpenTabs';
import { Favicon } from './Favicon';

/** Tabs in strip order, with consecutive tabs of the same group gathered together. */
type Row = { kind: 'tab'; tab: Tab } | { kind: 'group'; groupId: number; group?: GroupLike; tabs: Tab[] };

function toRows(tabs: Tab[], groups: GroupLike[]): Row[] {
  const rows: Row[] = [];
  for (const tab of tabs) {
    const last = rows.at(-1);
    if (!isGrouped(tab)) rows.push({ kind: 'tab', tab });
    else if (last?.kind === 'group' && last.groupId === tab.groupId) last.tabs.push(tab);
    else {
      const group = groups.find((g) => g.id === tab.groupId);
      rows.push({ kind: 'group', groupId: tab.groupId!, group, tabs: [tab] });
    }
  }
  return rows;
}

const toTabLike = (tab: Tab): TabLike => ({
  id: tab.id,
  url: tab.url,
  title: tab.title,
  favIconUrl: tab.favIconUrl,
  groupId: tab.groupId,
});

export function OpenTabsSidebar() {
  const { tabs, groups } = useOpenTabs();
  const { settings, setSettings, apply } = useStore();
  const rows = toRows(tabs, groups);

  const saveAll = () => {
    const { collections, savedTabs } = collectionsFromWindow(tabs, groups);
    if (collections.length === 0) return;
    void apply(insertCollections(collections));
    if (settings.closeAfterSave) void closeTabs(savedTabs.map((t) => t.id));
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <h2>Open tabs</h2>
        <button
          className="btn btn--primary btn--small"
          disabled={tabs.length === 0}
          title={groups.length > 0 ? 'Each tab group becomes its own collection' : undefined}
          onClick={saveAll}
        >
          Save window
        </button>
      </div>
      <label className="sidebar__option">
        <input
          type="checkbox"
          checked={settings.closeAfterSave}
          onChange={(e) => setSettings({ closeAfterSave: e.target.checked })}
        />
        Close tabs after saving
      </label>
      <ul className="sidebar__list">
        {rows.map((row) =>
          row.kind === 'tab' ? (
            <TabItem key={row.tab.id} tab={row.tab} />
          ) : (
            <TabGroupItem key={`g${row.groupId}`} groupId={row.groupId} group={row.group} tabs={row.tabs} />
          ),
        )}
        {tabs.length === 0 && <li className="muted sidebar__empty">No other tabs open in this window.</li>}
      </ul>
      <p className="sidebar__hint muted">Drag a tab or a whole group onto a collection to save it.</p>
    </aside>
  );
}

function TabGroupItem({ groupId, group, tabs }: { groupId: number; group?: GroupLike; tabs: Tab[] }) {
  const { settings, apply } = useStore();
  const info: GroupLike = group ?? { id: groupId, color: 'grey' };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `group:${groupId}`,
    data: { type: 'group', group: info, tabs: tabs.map(toTabLike) },
  });

  const save = () => {
    const collection = collectionFromGroup(info, tabs);
    if (!collection) return;
    void apply(insertCollection(collection));
    if (settings.closeAfterSave) void closeTabs(tabs.map((t) => t.id));
  };

  return (
    <li className={`tab-group group-border--${info.color}${isDragging ? ' tab-item--dragging' : ''}`}>
      <div className="tab-group__header">
        <div
          ref={setNodeRef}
          className="tab-group__handle"
          title="Drag to save the whole group"
          {...attributes}
          {...listeners}
        >
          <span className={`group-dot group-dot--${info.color}`} />
          <span className="tab-item__title">{groupTitle(group)}</span>
          <span className="muted">{tabs.length}</span>
        </div>
        <button className="btn btn--small" onClick={save}>
          Save group
        </button>
      </div>
      <ul className="tab-group__tabs">
        {tabs.map((tab) => (
          <TabItem key={tab.id} tab={tab} />
        ))}
      </ul>
    </li>
  );
}

function TabItem({ tab }: { tab: Tab }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tab:${tab.id}`,
    data: { type: 'tab', tab: toTabLike(tab) },
  });

  return (
    <li
      ref={setNodeRef}
      className={`tab-item${isDragging ? ' tab-item--dragging' : ''}${tab.active ? ' tab-item--active' : ''}`}
      title={tab.url}
      {...attributes}
      {...listeners}
      onClick={() => tab.id !== undefined && browser.tabs.update(tab.id, { active: true })}
    >
      <Favicon src={tab.favIconUrl} url={tab.url ?? ''} />
      <span className="tab-item__title">{tab.title || tab.url}</span>
      <button
        className="icon-btn tab-item__close"
        title="Close tab"
        onClick={(e) => {
          e.stopPropagation();
          void closeTabs([tab.id]);
        }}
      >
        ×
      </button>
    </li>
  );
}
