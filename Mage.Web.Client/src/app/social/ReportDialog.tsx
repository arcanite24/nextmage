import { useState, type FormEvent } from 'react';
import { api } from '../connection';
import { useLobby } from '../stores/lobby';
import { notify } from '../stores/toasts';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import styles from './ReportDialog.module.css';

const REASONS = [
  { value: 'abuse', label: 'Abusive chat or harassment' },
  { value: 'cheating', label: 'Cheating or exploiting a bug' },
  { value: 'stalling', label: 'Stalling or leaving games on purpose' },
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'other', label: 'Something else' },
] as const;

/** Tells the server's admins about a player. The player isn't told who reported them. */
export function ReportDialog() {
  const name = useLobby((state) => state.reporting);
  const close = () => useLobby.getState().openReport(null);
  return (
    <Dialog open={!!name} onOpenChange={(open) => !open && close()} title={name ? `Report ${name}` : 'Report'} width="sm"
      description="The server's admins read reports and can mute or lock players out. Only they see who filed it.">
      {name && <ReportForm name={name} onDone={close} />}
    </Dialog>
  );
}

function ReportForm({ name, onDone }: { name: string; onDone(): void }) {
  const [reason, setReason] = useState<string>('abuse');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.reportPlayer(name, reason, details.trim(), null);
      notify('Report sent', `Thanks. The admins will look at your report about ${name}.`);
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <fieldset className={styles.reasons}>
        <legend>What happened?</legend>
        {REASONS.map((choice) => (
          <label key={choice.value} className={styles.reason}>
            <input type="radio" name="reason" value={choice.value} checked={reason === choice.value} onChange={() => setReason(choice.value)} />
            {choice.label}
          </label>
        ))}
      </fieldset>
      <label className={styles.details}>
        <span>Details (optional)</span>
        <textarea value={details} maxLength={1000} rows={4} onChange={(event) => setDetails(event.target.value)}
          placeholder="What they said or did, and when. Which game, if it was in one." />
      </label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>
        <Button variant="quiet" onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="danger" busy={busy}>Send report</Button>
      </div>
    </form>
  );
}
