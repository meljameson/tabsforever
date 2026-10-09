import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { addCards, cardTitle, deleteCard, findCard, hostname, isOpenable, updateCard } from '../model/ops';
import { useStore } from '../model/store';
import type { Card } from '../model/types';
import { openCard } from '../tabs/actions';
import { Favicon } from './Favicon';

export function LinkCard({ card }: { card: Card }) {
  const [editing, setEditing] = useState(false);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, data: { type: 'card', cardId: card.id }, disabled: editing });
  const openable = isOpenable(card.url);

  const ref = (node: HTMLElement | null) => {
    setNodeRef(node);
    setActivatorNodeRef(node);
  };
  const style = { transform: CSS.Translate.toString(transform), transition };

  if (editing) {
    return (
      <div ref={setNodeRef} style={style} className="card card--editing">
        <CardEditor card={card} onDone={() => setEditing(false)} />
      </div>
    );
  }

  const open = (e: MouseEvent | KeyboardEvent) => {
    // Ctrl/Cmd/middle click opens in the background, like a normal link.
    const background = 'button' in e ? e.button === 1 || e.ctrlKey || e.metaKey : e.ctrlKey || e.metaKey;
    void openCard(card, !background);
  };

  return (
    <div
      ref={ref}
      style={style}
      className={`card${isDragging ? ' card--dragging' : ''}${openable ? '' : ' card--disabled'}`}
      {...attributes}
      {...listeners}
      role="link"
      aria-disabled={!openable}
      title={openable ? card.url : `${card.url}\n(This browser page can't be opened by extensions.)`}
      onClick={open}
      onAuxClick={(e) => e.button === 1 && open(e)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget && !isDragging) open(e);
        else listeners?.onKeyDown?.(e);
      }}
    >
      <CardBody card={card} />
      <div className="card__actions">
        <button
          className="icon-btn"
          title="Edit"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
        >
          ✎
        </button>
        <button
          className="icon-btn"
          title="Delete"
          onClick={(e) => {
            e.stopPropagation();
            removeCard(card);
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

/** Visual content of a card; also used for the drag overlay. */
export function CardBody({ card }: { card: Card }) {
  return (
    <>
      <div className="card__head">
        <Favicon src={card.favIconUrl} url={card.url} />
        <span className="card__title">{cardTitle(card)}</span>
      </div>
      <div className="card__host">{hostname(card.url) || card.url}</div>
      {card.note && <p className="card__note">{card.note}</p>}
      {card.tags.length > 0 && (
        <div className="card__tags">
          {card.tags.map((tag) => (
            <span key={tag} className="tag">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function removeCard(card: Card) {
  const { root, apply, showToast } = useStore.getState();
  const found = findCard(root, card.id);
  if (!found) return;
  void apply(deleteCard(card.id));
  showToast(`Deleted "${cardTitle(card)}"`, addCards(found.collection.id, [found.card], found.index));
}

function CardEditor({ card, onDone }: { card: Card; onDone: () => void }) {
  const apply = useStore((s) => s.apply);
  const [title, setTitle] = useState(cardTitle(card));
  const [note, setNote] = useState(card.note ?? '');
  const [tags, setTags] = useState(card.tags.join(', '));

  const save = (e: FormEvent) => {
    e.preventDefault();
    const customTitle = title.trim() && title.trim() !== card.title ? title.trim() : undefined;
    void apply(
      updateCard(card.id, {
        customTitle,
        note: note.trim() || undefined,
        tags: tags.split(','),
      }),
    );
    onDone();
  };

  return (
    <form className="editor" onSubmit={save} onKeyDown={(e) => e.key === 'Escape' && onDone()}>
      <label>
        Title
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        Note
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <label>
        Tags <span className="muted">(comma separated)</span>
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="work, reading" />
      </label>
      <div className="editor__buttons">
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary">
          Save
        </button>
      </div>
    </form>
  );
}
