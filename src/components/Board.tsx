import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useMemo, useState } from 'react';
import { dropOp, type DragData, type DropData } from '../model/drop';
import { createCollection, findCard, groupTitle, insertCollection } from '../model/ops';
import { useStore } from '../model/store';
import { filterCollections, isFiltering } from '../search';
import { closeTabs } from '../tabs/actions';
import { CollectionCard } from './CollectionCard';
import { Favicon } from './Favicon';
import { CardBody } from './LinkCard';
import { OpenTabsSidebar } from './OpenTabsSidebar';

type WithData = { data: { current?: unknown } };
const dataOf = <T,>(d: WithData) => d.data.current as T;
const typeOf = (d: WithData) => dataOf<{ type?: string } | undefined>(d)?.type;

/**
 * Collections are sortable and contain sortable cards, so collisions are
 * scoped by what is being dragged: collections only collide with collections;
 * tabs and cards prefer the card under the pointer, then the collection body.
 */
const collisionDetection: CollisionDetection = (args) => {
  const isCollection = (c: WithData) => typeOf(c) === 'collection';
  if (isCollection(args.active)) {
    return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter(isCollection) });
  }
  const droppableContainers = args.droppableContainers.filter((c) => !isCollection(c));
  const hits = pointerWithin({ ...args, droppableContainers });
  if (hits.length === 0) return rectIntersection({ ...args, droppableContainers });
  const cardHit = hits.find((h) => {
    const container = droppableContainers.find((c) => c.id === h.id);
    return container && typeOf(container) === 'card';
  });
  return cardHit ? [cardHit] : hits;
};

export function Board() {
  const { root, loaded, query, activeTags, settings, apply, requestRename, clearFilter } = useStore();
  const filter = { query, tags: activeTags };
  const filtering = isFiltering(filter);
  const collections = useMemo(() => filterCollections(root, filter), [root, query, activeTags]);
  const [dragging, setDragging] = useState<DragData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter opens a card, so only Space picks things up.
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  );

  const onDragStart = (e: DragStartEvent) => setDragging(dataOf<DragData>(e.active));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (!over) return;
    const drag = dataOf<DragData>(active);
    const op = dropOp(root, drag, dataOf<DropData>(over));
    if (!op) return;
    void apply(op);
    if (settings.closeAfterSave) {
      if (drag.type === 'tab') void closeTabs([drag.tab.id]);
      if (drag.type === 'group') void closeTabs(drag.tabs.map((t) => t.id));
    }
  };

  const newCollection = () => {
    const collection = createCollection('New collection');
    void apply(insertCollection(collection));
    requestRename(collection.id);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="board">
        <main className="dashboard">
          <div className="dashboard__toolbar">
            <NewCollectionZone active={dragging !== null && dragging.type !== 'collection'} />
            <button className="btn" onClick={newCollection}>
              + New collection
            </button>
          </div>

          {loaded && root.collections.length === 0 && (
            <div className="empty">
              <h2>No collections yet</h2>
              <p>
                Drag a tab from the right into the drop zone above, or use <b>Save window</b> to stash
                every open tab at once. You can also import a Toby export from the menu.
              </p>
            </div>
          )}
          {filtering && collections.length === 0 && root.collections.length > 0 && (
            <div className="empty">
              <p>Nothing matches.</p>
              <button className="btn" onClick={clearFilter}>
                Clear search
              </button>
            </div>
          )}

          <SortableContext items={collections.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {collections.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} filtering={filtering} />
            ))}
          </SortableContext>
        </main>
        <OpenTabsSidebar />
      </div>

      <DragOverlay dropAnimation={null}>{dragging && <DragPreview drag={dragging} />}</DragOverlay>
    </DndContext>
  );
}

function NewCollectionZone({ active }: { active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'new-collection', data: { type: 'new-collection' } });
  return (
    <div
      ref={setNodeRef}
      className={`new-zone${active ? ' is-active' : ''}${isOver ? ' is-over' : ''}`}
    >
      Drop here to create a new collection
    </div>
  );
}

function DragPreview({ drag }: { drag: DragData }) {
  const root = useStore((s) => s.root);
  if (drag.type === 'tab') {
    return (
      <div className="tab-item tab-item--overlay">
        <Favicon src={drag.tab.favIconUrl} url={drag.tab.url ?? ''} />
        <span className="tab-item__title">{drag.tab.title}</span>
      </div>
    );
  }
  if (drag.type === 'group') {
    return (
      <div className="tab-group__handle tab-item--overlay">
        <span className={`group-dot group-dot--${drag.group.color}`} />
        <span className="tab-item__title">{groupTitle(drag.group)}</span>
        <span className="muted">{drag.tabs.length} tabs</span>
      </div>
    );
  }
  if (drag.type === 'card') {
    const found = findCard(root, drag.cardId);
    return found ? (
      <div className="card card--overlay">
        <CardBody card={found.card} />
      </div>
    ) : null;
  }
  const collection = root.collections.find((c) => c.id === drag.collectionId);
  return collection ? <div className="collection-overlay">{collection.title}</div> : null;
}
