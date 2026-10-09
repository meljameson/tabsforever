import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { backupFilename, parseImport, toBackup, type ImportSource } from '../import/backup';
import type { ImportResult } from '../import/toby';
import { appendCollections } from '../model/ops';
import { useStore } from '../model/store';

type Parsed = ImportResult & { source: ImportSource; fileName: string };

export function ImportExportDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { root, apply, showToast } = useStore();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(toBackup(root), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFilename();
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsed(null);
    setError(null);
    try {
      setParsed({ ...parseImport(await file.text()), fileName: file.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const doImport = (mode: 'merge' | 'replace') => {
    if (!parsed) return;
    if (mode === 'replace') {
      const previous = root;
      void apply(() => ({ schemaVersion: 1, collections: parsed.collections }));
      showToast(`Replaced everything with ${parsed.collections.length} collections`, () => previous);
    } else {
      void apply(appendCollections(parsed.collections));
      showToast(`Imported ${parsed.collections.length} collections`);
    }
    onClose();
  };

  return (
    <dialog ref={dialog} className="dialog" onClose={onClose}>
      <h2>Import / Export</h2>

      <section>
        <h3>Export</h3>
        <p className="muted">Download all collections as a JSON backup.</p>
        <button className="btn" onClick={exportJson} disabled={root.collections.length === 0}>
          Download backup
        </button>
      </section>

      <section>
        <h3>Import</h3>
        <p className="muted">A tabsforever backup or a Toby export (.json).</p>
        <input type="file" accept="application/json,.json" onChange={onFile} />
        {error && <p className="error">{error}</p>}
        {parsed && (
          <div className="import-preview">
            <p>
              <b>{parsed.fileName}</b> ({parsed.source === 'toby' ? 'Toby export' : 'tabsforever backup'}):{' '}
              {parsed.collections.length} collections, {parsed.cardCount} links
              {parsed.skipped > 0 && `, ${parsed.skipped} skipped (no valid URL)`}.
            </p>
            <div className="dialog__buttons">
              <button className="btn btn--primary" onClick={() => doImport('merge')}>
                Add to my collections
              </button>
              <button className="btn btn--danger" onClick={() => doImport('replace')}>
                Replace everything
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="dialog__buttons">
        <button className="btn" onClick={() => dialog.current?.close()}>
          Close
        </button>
      </div>
    </dialog>
  );
}
