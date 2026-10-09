import { useEffect, useMemo, useRef, useState } from 'react';
import { allTags } from '../model/ops';
import { useStore } from '../model/store';
import { ImportExportDialog } from './ImportExportDialog';

export function Header() {
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <header className="header">
      <div className="header__row">
        <h1 className="logo">tabsforever</h1>
        <SearchBar />
        <button className="btn" onClick={() => setDialogOpen(true)}>
          Import / Export
        </button>
      </div>
      <TagFilter />
      {dialogOpen && <ImportExportDialog onClose={() => setDialogOpen(false)} />}
    </header>
  );
}

function SearchBar() {
  const { query, setQuery } = useStore();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === '/' && !target.closest('input, textarea, [contenteditable]')) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <input
      ref={input}
      className="search"
      type="search"
      placeholder="Search links, notes, #tags…  ( / )"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setQuery('');
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function TagFilter() {
  const { root, activeTags, toggleTag } = useStore();
  const tags = useMemo(() => allTags(root), [root]);
  if (tags.length === 0) return null;
  return (
    <div className="tag-filter">
      {tags.map((tag) => (
        <button
          key={tag}
          className={`tag tag--button${activeTags.includes(tag) ? ' tag--active' : ''}`}
          aria-pressed={activeTags.includes(tag)}
          onClick={() => toggleTag(tag)}
        >
          #{tag}
        </button>
      ))}
    </div>
  );
}
