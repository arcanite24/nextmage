import { X } from 'lucide-react';
import { useToasts } from '../stores/toasts';
import styles from './Toaster.module.css';

/** Server messages, placed on the mat's lower right corner. */
export function Toaster() {
  const toasts = useToasts((state) => state.toasts);
  const dismiss = useToasts((state) => state.dismiss);
  return (
    <ol className={styles.stack} aria-live="polite">
      {toasts.map((toast) => (
        <li key={toast.id} className={[styles.toast, toast.tone === 'error' ? styles.error : ''].join(' ')} role={toast.tone === 'error' ? 'alert' : 'status'}>
          <div>
            <strong className={styles.title}>{toast.title}</strong>
            {toast.message && <p className={styles.message}>{toast.message}</p>}
          </div>
          {toast.action && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                toast.action!.run();
                dismiss(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button type="button" className={styles.close} aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
            <X size={16} />
          </button>
        </li>
      ))}
    </ol>
  );
}
