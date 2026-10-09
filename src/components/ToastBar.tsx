import { useEffect } from 'react';
import { useStore } from '../model/store';

const TOAST_MS = 6000;

export function ToastBar() {
  const { toast, dismissToast, apply } = useStore();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismissToast, TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);

  if (!toast) return null;
  return (
    <div className="toast" role="status">
      <span>{toast.message}</span>
      {toast.undo && (
        <button
          className="btn btn--small"
          onClick={() => {
            void apply(toast.undo!);
            dismissToast();
          }}
        >
          Undo
        </button>
      )}
      <button className="icon-btn" title="Dismiss" onClick={dismissToast}>
        ×
      </button>
    </div>
  );
}
