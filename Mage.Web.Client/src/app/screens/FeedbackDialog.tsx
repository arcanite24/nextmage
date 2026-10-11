import { useState, type FormEvent } from 'react';
import { api } from '../connection';
import { useSession } from '../stores/session';
import { notify } from '../stores/toasts';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import styles from '../social/ReportDialog.module.css';

const TYPES = [
  { value: 'bug', label: 'Something is broken' },
  { value: 'idea', label: 'An idea' },
  { value: 'other', label: 'Something else' },
] as const;

/** Feedback for the server's staff: it lands in the admin console's Feedback inbox. */
export function FeedbackDialog({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Send feedback" width="sm"
      description="The server's staff read it. Say what you were doing; the page you are on and the app version are sent with it.">
      {open && <FeedbackForm onDone={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function FeedbackForm({ onDone }: { onDone(): void }) {
  const [type, setType] = useState<string>('bug');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const context = `${window.location.pathname} · ${import.meta.env.VITE_APP_VERSION ?? 'dev'}`;
      await api.sendFeedback(useSession.getState().userName, '', type, message.trim(), context);
      notify('Feedback sent', 'Thanks. The server’s staff will read it.');
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
        <legend>What is it?</legend>
        {TYPES.map((choice) => (
          <label key={choice.value} className={styles.reason}>
            <input type="radio" name="type" value={choice.value} checked={type === choice.value} onChange={() => setType(choice.value)} />
            {choice.label}
          </label>
        ))}
      </fieldset>
      <label className={styles.details}>
        <span>Your feedback</span>
        <textarea value={message} maxLength={4000} rows={6} required autoFocus onChange={(event) => setMessage(event.target.value)}
          placeholder={type === 'bug' ? 'What happened, and what you expected. Which card or screen, if you know.' : ''} />
      </label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>
        <Button variant="quiet" onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="decision" busy={busy} disabled={!message.trim()}>Send</Button>
      </div>
    </form>
  );
}
