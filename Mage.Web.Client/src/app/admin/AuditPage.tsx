import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { createApi } from '../../protocol/generated/api';
import type { AuditEntry } from '../../protocol/generated/views';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { formatDate } from './adminFormat';
import styles from './AdminScreen.module.css';

type AdminApi = ReturnType<typeof createApi>;

const FAMILIES = [
  { value: '', label: 'Everything' },
  { value: 'access', label: 'Access' },
  { value: 'user', label: 'Players' },
  { value: 'table', label: 'Tables' },
  { value: 'report', label: 'Reports' },
  { value: 'broadcast', label: 'Broadcasts' },
  { value: 'staff', label: 'Staff roles' },
];

/** Every staff action: who did what to whom, and why. */
export function AuditPage({ api }: { api: AdminApi }) {
  const [family, setFamily] = useState('');
  const [actor, setActor] = useState('');
  const [target, setTarget] = useState('');
  const log = useInfiniteQuery({
    queryKey: ['admin', 'audit', family, actor.trim(), target.trim()],
    queryFn: ({ pageParam }) => api.adminAudit(actor.trim() || null, family || null, target.trim() || null, pageParam || null),
    initialPageParam: 0,
    getNextPageParam: (page: AuditEntry[]) => (page.length === 100 ? page[page.length - 1].id : undefined),
  });
  const entries = log.data?.pages.flat() ?? [];
  return (
    <div className={styles.block}>
      <div className={styles.toolbar}>
        <label className={styles.select}>
          <span>What</span>
          <select value={family} onChange={(event) => setFamily(event.target.value)}>
            {FAMILIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <Field label="By" value={actor} onChange={(event) => setActor(event.target.value)} placeholder="console, boot, a name" />
        <Field label="About" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="a player or entry" />
      </div>
      {log.error && <p className={styles.error}>{String(log.error)}</p>}
      {log.isSuccess && entries.length === 0 && <p className={styles.quiet}>Nothing recorded{family || actor || target ? ' that matches' : ' yet'}.</p>}
      {entries.length > 0 && (
        <table className={styles.table}>
          <thead><tr><th>When</th><th>By</th><th>What</th><th>About</th><th>Detail</th><th>Reason</th></tr></thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{formatDate(entry.at ?? 0)}</td>
                <td>{entry.actor}</td>
                <td><span className={styles.chip}>{entry.action}</span></td>
                <td>{entry.target}</td>
                <td className={styles.clip} title={entry.detail ?? undefined}>{entry.detail}</td>
                <td>{entry.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {log.hasNextPage && (
        <div><Button size="sm" variant="quiet" busy={log.isFetchingNextPage} onClick={() => void log.fetchNextPage()}>Older</Button></div>
      )}
    </div>
  );
}
