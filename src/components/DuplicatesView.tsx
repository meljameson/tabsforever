import { useMemo } from 'react';
import { findDuplicates, keepOnly, type DuplicateGroup } from '../model/duplicates';
import { cardTitle } from '../model/ops';
import { useStore } from '../model/store';
import { filterCollections, isFiltering } from '../search';
import { CardBody } from './LinkCard';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

/** Every link saved more than once, with its copies side by side. */
export function DuplicatesView() {
  const { root, query, activeTags, setShowDuplicates } = useStore();
  const groups = useMemo(() => {
    const all = findDuplicates(root);
    const filter = { query, tags: activeTags };
    if (!isFiltering(filter)) return all;
    // Search/tags narrow the list to links with at least one matching copy.
    const visible = new Set(filterCollections(root, filter).flatMap((c) => c.cards.map((card) => card.id)));
    return all.filter((g) => g.copies.some((copy) => visible.has(copy.card.id)));
  }, [root, query, activeTags]);

  return (
    <section className="duplicates">
      <header className="duplicates__header">
        <h2>
          Duplicates <span className="muted">({groups.length})</span>
        </h2>
        <p className="muted">Links saved more than once. Pick the copy to keep; the others are removed.</p>
        <button className="btn btn--small" onClick={() => setShowDuplicates(false)}>
          Back to collections
        </button>
      </header>

      {groups.length === 0 && <div className="empty">No duplicate links. Everything is saved once.</div>}
      {groups.map((group) => (
        <DuplicateRow key={group.key} group={group} />
      ))}
    </section>
  );
}

function DuplicateRow({ group }: { group: DuplicateGroup }) {
  const { apply, showToast } = useStore();
  const first = group.copies[0]!.card;

  const keep = (cardId: string) => {
    const result = keepOnly(useStore.getState().root, cardId);
    if (!result) return;
    void apply(result.op);
    showToast(`Removed ${result.removed} ${result.removed === 1 ? 'copy' : 'copies'} of “${cardTitle(first)}”`, result.undo);
  };

  return (
    <article className="dup-group">
      <div className="dup-group__head">
        <span className="dup-group__title">{cardTitle(first)}</span>
        <span className="muted dup-group__url">{first.url}</span>
        <span className="dup-group__count">{group.copies.length} copies</span>
      </div>
      <div className="dup-group__copies">
        {group.copies.map(({ card, collection }) => (
          <div key={card.id} className="dup-copy">
            <div className="dup-copy__where">
              in <b>{collection.title}</b> · saved {dateFormat.format(card.createdAt)}
            </div>
            <div className="card card--static">
              <CardBody card={card} />
            </div>
            <button className="btn btn--small" onClick={() => keep(card.id)}>
              Keep this one
            </button>
          </div>
        ))}
      </div>
    </article>
  );
}
