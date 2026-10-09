import { useDroppable } from '@dnd-kit/core';
import { rectSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useState } from 'react';
import {
  collectionIndex,
  deleteCollection,
  insertCollection,
  renameCollection,
  setCollapsed,
} from '../model/ops';
import { useStore } from '../model/store';
import type { Collection } from '../model/types';
import { openCollection } from '../tabs/actions';
import { LinkCard } from './LinkCard';

interface Props {
  collection: Collection;
  /** True while search/tag filtering; collapsed collections are shown open. */
  filtering: boolean;
}

export function CollectionCard({ collection, filtering }: Props) {
  const apply = useStore((s) => s.apply);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: collection.id, data: { type: 'collection', collectionId: collection.id } });
  const body = useDroppable({
    id: `body:${collection.id}`,
    data: { type: 'collection-body', collectionId: collection.id },
  });
  const expanded = filtering || !collection.collapsed;
  const count = collection.cards.length;

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`collection${isDragging ? ' collection--dragging' : ''}`}
    >
      <div ref={body.setNodeRef} className={`collection__inner${body.isOver ? ' is-over' : ''}`}>
        <header className="collection__header">
          <button
            ref={setActivatorNodeRef}
            className="icon-btn handle"
            title="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            ⠿
          </button>
          <button
            className="icon-btn"
            title={expanded ? 'Collapse' : 'Expand'}
            disabled={filtering}
            onClick={() => apply(setCollapsed(collection.id, !collection.collapsed))}
          >
            {expanded ? '▾' : '▸'}
          </button>
          {collection.tabGroup && (
            <span
              className={`group-dot group-dot--${collection.tabGroup.color}`}
              title="Saved from a tab group. Opening it recreates the group."
            />
          )}
          <CollectionTitle collection={collection} />
          <span className="collection__count">
            {count} {count === 1 ? 'tab' : 'tabs'}
          </span>
          <div className="collection__actions">
            <button className="btn btn--small" disabled={count === 0} onClick={() => openCollection(collection)}>
              Open all
            </button>
            <button
              className="btn btn--small"
              disabled={count === 0}
              onClick={() => openCollection(collection, true)}
            >
              New window
            </button>
            <button className="icon-btn" title="Delete collection" onClick={() => removeCollection(collection.id)}>
              <TrashIcon />
            </button>
          </div>
        </header>

        {expanded && (
          <SortableContext items={collection.cards.map((c) => c.id)} strategy={rectSortingStrategy}>
            <div className="collection__cards">
              {collection.cards.map((card) => (
                <LinkCard key={card.id} card={card} />
              ))}
              {count === 0 && <div className="collection__empty">Drag tabs here</div>}
            </div>
          </SortableContext>
        )}
      </div>
    </section>
  );
}

function CollectionTitle({ collection }: { collection: Collection }) {
  const { apply, renameRequest, requestRename } = useStore();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(collection.title);

  useEffect(() => {
    if (renameRequest === collection.id) {
      setTitle(collection.title);
      setEditing(true);
      requestRename(null);
    }
  }, [renameRequest, collection.id, collection.title, requestRename]);

  if (!editing) {
    return (
      <button
        className="collection__title"
        title="Rename"
        onClick={() => {
          setTitle(collection.title);
          setEditing(true);
        }}
      >
        {collection.title}
      </button>
    );
  }

  const commit = () => {
    const next = title.trim();
    if (next && next !== collection.title) void apply(renameCollection(collection.id, next));
    setEditing(false);
  };

  return (
    <input
      className="collection__title-input"
      autoFocus
      onFocus={(e) => e.target.select()}
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setEditing(false);
      }}
    />
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
    </svg>
  );
}

function removeCollection(collectionId: string) {
  const { root, apply, showToast } = useStore.getState();
  const index = collectionIndex(root, collectionId);
  const collection = root.collections[index];
  if (!collection) return;
  void apply(deleteCollection(collectionId));
  showToast(`Deleted "${collection.title}"`, insertCollection(collection, index));
}
