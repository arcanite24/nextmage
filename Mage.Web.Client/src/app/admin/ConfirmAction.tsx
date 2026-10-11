import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import styles from './AdminScreen.module.css';

/**
 * A destructive action, spelled out before it happens: who it signs out, and a reason for the audit log.
 */
export function ConfirmAction({ title, what, preview, previewKey, confirmLabel, onConfirm, onCancel }: {
  title: string;
  /** what will happen, in a sentence */
  what: ReactNode;
  /** the players this would sign out, asked from the server */
  preview?: () => Promise<string[]>;
  previewKey?: unknown[];
  confirmLabel: string;
  onConfirm(reason: string): Promise<unknown>;
  onCancel(): void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const affected = useQuery({
    queryKey: ['admin', 'preview', ...(previewKey ?? [title])],
    queryFn: () => preview!(),
    enabled: !!preview,
    staleTime: 0,
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.confirm} onSubmit={submit} aria-label={title}>
      <h3>{title}</h3>
      <p>{what}</p>
      {preview && (
        affected.isLoading ? <p className={styles.quiet}>Checking who is online…</p>
          : affected.error ? <p className={styles.error}>{String(affected.error)}</p>
            : (affected.data?.length ?? 0) === 0 ? <p className={styles.quiet}>Nobody online is signed out by this.</p>
              : (
                <div>
                  <p className={styles.alarm}>Signs out {affected.data!.length === 1 ? 'one player' : `${affected.data!.length} players`} now:</p>
                  <ul className={styles.names}>{affected.data!.map((name) => <li key={name}>{name}</li>)}</ul>
                </div>
              )
      )}
      <Field label="Reason (kept in the audit log)" value={reason} maxLength={500} autoFocus required
        onChange={(event) => setReason(event.target.value)} />
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.inline}>
        <Button type="submit" size="sm" variant="danger" busy={busy} disabled={!reason.trim() || affected.isLoading}>{confirmLabel}</Button>
        <Button type="button" size="sm" variant="quiet" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
