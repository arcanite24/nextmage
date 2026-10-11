import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Eye, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { createApi } from '../../protocol/generated/api';
import type { FeedbackEntry } from '../../protocol/generated/views';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { describeAge } from './adminFormat';
import styles from './AdminScreen.module.css';

type AdminApi = ReturnType<typeof createApi>;

const FILTERS = [
  { value: 'new', label: 'New' },
  { value: 'seen', label: 'Seen' },
  { value: 'done', label: 'Done' },
  { value: '', label: 'All' },
] as const;

/** What players sent with Send feedback, to read and work through. */
export function FeedbackPage({ api }: { api: AdminApi }) {
  const [status, setStatus] = useState<string>('new');
  const feedback = useQuery({ queryKey: ['admin', 'feedback', status], queryFn: () => api.adminFeedback(status || null), refetchInterval: 30_000 });
  const now = feedback.dataUpdatedAt;
  return (
    <div className={styles.block}>
      <div className={styles.inline} role="group" aria-label="Show">
        {FILTERS.map((filter) => (
          <Button key={filter.value} size="sm" variant={status === filter.value ? 'decision' : 'quiet'} aria-pressed={status === filter.value}
            onClick={() => setStatus(filter.value)}>{filter.label}</Button>
        ))}
      </div>
      {feedback.error && <p className={styles.error}>{String(feedback.error)}</p>}
      {feedback.data?.length === 0 && <p className={styles.quiet}>{status === 'new' ? 'Nothing new. Players send feedback from the account menu.' : 'Nothing here.'}</p>}
      <ul className={styles.reports}>
        {(feedback.data ?? []).map((entry) => <Item key={entry.id} api={api} entry={entry} now={now} />)}
      </ul>
    </div>
  );
}

function Item({ api, entry, now }: { api: AdminApi; entry: FeedbackEntry; now: number }) {
  const client = useQueryClient();
  const [note, setNote] = useState(entry.note ?? '');
  const [error, setError] = useState<string | null>(null);
  async function mark(status: string) {
    setError(null);
    try {
      await api.adminFeedbackMark(entry.id!, status, note.trim() || null);
      await client.invalidateQueries({ queryKey: ['admin', 'feedback'] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }
  return (
    <li className={styles.report}>
      <p><span className={styles.tag}>{entry.type}</span> <strong>{entry.title}</strong> · {entry.userName} · {describeAge(entry.createdAt ?? 0, now)}</p>
      {entry.message && entry.message !== entry.title && <blockquote>{entry.message}</blockquote>}
      {entry.context && <p className={styles.quiet}>{entry.context}</p>}
      {entry.handledBy && <p className={styles.quiet}>{entry.status} by {entry.handledBy}{entry.note ? `: ${entry.note}` : ''}</p>}
      <div className={styles.inline}>
        <Field label="Note" value={note} maxLength={300} placeholder="e.g. the issue it became" onChange={(event) => setNote(event.target.value)} />
        {entry.status === 'new' && <Button size="sm" variant="quiet" icon={<Eye size={14} />} onClick={() => mark('seen')}>Seen</Button>}
        {entry.status !== 'done' && <Button size="sm" icon={<Check size={14} />} onClick={() => mark('done')}>Done</Button>}
        {entry.status !== 'new' && <Button size="sm" variant="quiet" icon={<RotateCcw size={14} />} onClick={() => mark('new')}>Back to new</Button>}
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </li>
  );
}
