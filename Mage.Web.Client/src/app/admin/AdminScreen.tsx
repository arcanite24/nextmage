import * as Tabs from '@radix-ui/react-tabs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, LogOut, MicOff, Power, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { createApi } from '../../protocol/generated/api';
import type { ClientError, PlayerReport, ServerStats, TableView, UserView } from '../../protocol/generated/views';
import { RpcClient } from '../../core/rpc/RpcClient';
import { APP_NAME } from '../brand';
import { useSession } from '../stores/session';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { describeAge, formatBytes, formatDuration, MUTE_CHOICES } from './adminFormat';
import styles from './AdminScreen.module.css';

type AdminApi = ReturnType<typeof createApi>;

/**
 * The server's admin console: who is on, what is running, reports and crash reports, and the levers (mute, lock,
 * disconnect, remove a table, broadcast). It signs in on a connection of its own with the server's admin password,
 * so an admin can stay seated as a player in another tab.
 */
export function AdminScreen() {
  const [admin, setAdmin] = useState<{ api: AdminApi; rpc: RpcClient } | null>(null);
  useEffect(() => () => admin?.rpc.disconnect(), [admin]);
  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <Link to="/" className={styles.back}><ArrowLeft size={16} aria-hidden="true" /> {APP_NAME}</Link>
        <h1 className={styles.title}>Server admin</h1>
        {admin && (
          <Button size="sm" variant="quiet" icon={<LogOut size={15} />} onClick={() => setAdmin(null)}>Sign out</Button>
        )}
      </header>
      {admin ? <Console api={admin.api} /> : <AdminSignIn onSignedIn={setAdmin} />}
    </main>
  );
}

function AdminSignIn({ onSignedIn }: { onSignedIn(admin: { api: AdminApi; rpc: RpcClient }): void }) {
  const [serverUrl, setServerUrl] = useState(useSession.getState().serverUrl);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const rpc = new RpcClient();
    const api = createApi(rpc);
    try {
      await rpc.connect(serverUrl.trim());
      const ok = await api.connectAdmin(password);
      if (!ok) throw new Error('The server refused the admin password.');
      // a dropped connection comes back as a new session: sign in again with the password kept in memory
      rpc.onSessionStart(() => {
        api.connectAdmin(password).catch(() => undefined);
      });
      onSignedIn({ api, rpc });
    } catch (caught) {
      rpc.disconnect();
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.signIn} onSubmit={submit}>
      <p className={styles.lede}>Sign in with the server's admin password (XMAGE_ADMIN_PASSWORD). Wrong passwords slow further tries down.</p>
      <Field label="Server address" value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} spellCheck={false} />
      <Field label="Admin password" type="password" value={password} autoComplete="current-password" autoFocus
        onChange={(event) => setPassword(event.target.value)} required />
      {error && <p className={styles.error} role="alert">{error}</p>}
      <Button type="submit" variant="decision" busy={busy} disabled={!password}>Sign in</Button>
    </form>
  );
}

function Console({ api }: { api: AdminApi }) {
  return (
    <Tabs.Root defaultValue="overview" className={styles.tabs}>
      <Tabs.List className={styles.tabList} aria-label="Admin sections">
        <Tabs.Trigger value="overview" className={styles.tab}>Overview</Tabs.Trigger>
        <Tabs.Trigger value="players" className={styles.tab}>Players</Tabs.Trigger>
        <Tabs.Trigger value="tables" className={styles.tab}>Tables</Tabs.Trigger>
        <Tabs.Trigger value="reports" className={styles.tab}>Reports</Tabs.Trigger>
        <Tabs.Trigger value="errors" className={styles.tab}>Client errors</Tabs.Trigger>
        <Tabs.Trigger value="broadcast" className={styles.tab}>Broadcast</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="overview" className={styles.panel}><Overview api={api} /></Tabs.Content>
      <Tabs.Content value="players" className={styles.panel}><Players api={api} /></Tabs.Content>
      <Tabs.Content value="tables" className={styles.panel}><TablesPanel api={api} /></Tabs.Content>
      <Tabs.Content value="reports" className={styles.panel}><Reports api={api} /></Tabs.Content>
      <Tabs.Content value="errors" className={styles.panel}><ClientErrors api={api} /></Tabs.Content>
      <Tabs.Content value="broadcast" className={styles.panel}><Broadcast api={api} /></Tabs.Content>
    </Tabs.Root>
  );
}

function Overview({ api }: { api: AdminApi }) {
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api.adminServerStats(), refetchInterval: 5_000 });
  const data: ServerStats | undefined = stats.data;
  if (stats.error) return <p className={styles.error}>{String(stats.error)}</p>;
  if (!data) return <p className={styles.quiet}>Loading…</p>;
  const bridge = data.bridge;
  const buckets = bridge?.buckets ?? [];
  const limits = bridge?.bucketLimits ?? [];
  const most = Math.max(1, ...buckets);
  return (
    <div className={styles.overview}>
      <dl className={styles.numbers}>
        <Stat label="Players online" value={data.usersOnline ?? 0} />
        <Stat label="Tables" value={data.tables ?? 0} />
        <Stat label="Games running" value={data.activeGames ?? 0} />
        <Stat label="Connections" value={bridge?.connections ?? 0} />
        <Stat label="CPU (this server)" value={data.processCpu !== undefined && data.processCpu >= 0 ? `${Math.round(data.processCpu * 100)}%` : '—'} />
        <Stat label="Load (1 min)" value={data.systemLoad !== undefined && data.systemLoad >= 0 ? `${data.systemLoad.toFixed(2)} / ${data.processors} cores` : '—'} />
        <Stat label="Memory" value={`${formatBytes(data.heapUsed ?? 0)} of ${formatBytes(data.heapMax ?? 0)}`} />
        <Stat label="Up for" value={formatDuration(data.uptimeMillis ?? 0)} />
      </dl>

      <section aria-labelledby="sizes" className={styles.block}>
        <h2 id="sizes">Messages to web clients</h2>
        <p className={styles.quiet}>{(bridge?.messages ?? 0).toLocaleString()} sent, {formatBytes(bridge?.chars ?? 0)} of JSON; {(bridge?.requests ?? 0).toLocaleString()} requests received.</p>
        {(bridge?.stateFullChars ?? 0) > 0 && (
          <p className={styles.quiet}>
            Game states: {(bridge?.statePatches ?? 0).toLocaleString()} sent as patches, {(bridge?.stateComplete ?? 0).toLocaleString()} complete
            ({(bridge?.stateResyncs ?? 0).toLocaleString()} resyncs); {formatBytes(bridge?.stateChars ?? 0)} instead
            of {formatBytes(bridge?.stateFullChars ?? 0)}, {Math.round((1 - (bridge?.stateChars ?? 0) / (bridge?.stateFullChars ?? 1)) * 100)}% saved.
          </p>
        )}
        <ol className={styles.histogram}>
          {buckets.map((count, index) => (
            <li key={index}>
              <span className={styles.bucketLabel}>{index < limits.length ? `≤ ${formatBytes(limits[index])}` : `> ${formatBytes(limits[limits.length - 1] ?? 0)}`}</span>
              <span className={styles.bar} style={{ inlineSize: `${(count / most) * 100}%` }} />
              <span className={styles.bucketCount}>{count.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="heavy" className={styles.block}>
        <h2 id="heavy">Heaviest callbacks</h2>
        <table className={styles.table}>
          <thead><tr><th>Callback</th><th>Sent</th><th>Total</th><th>Largest</th></tr></thead>
          <tbody>
            {(bridge?.heaviest ?? []).map((entry) => (
              <tr key={entry.method}>
                <td>{entry.method}</td>
                <td>{(entry.count ?? 0).toLocaleString()}</td>
                <td>{formatBytes(entry.chars ?? 0)}</td>
                <td className={(entry.maxChars ?? 0) > 256 * 1024 ? styles.alarm : undefined}>{formatBytes(entry.maxChars ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {(bridge?.large?.length ?? 0) > 0 && (
        <section aria-labelledby="large" className={styles.block}>
          <h2 id="large" className={styles.alarm}>Messages over 256 KB</h2>
          <ul className={styles.list}>
            {bridge!.large!.map((entry, index) => (
              <li key={index}>{entry.method} · {formatBytes(entry.chars ?? 0)} · {describeAge(entry.at ?? 0, data.now ?? 0)}{entry.objectId ? ` · ${entry.objectId}` : ''}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.stat}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Players({ api }: { api: AdminApi }) {
  const client = useQueryClient();
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: () => api.adminGetUsers(), refetchInterval: 5_000 });
  const [filter, setFilter] = useState('');
  const [minutes, setMinutes] = useState(MUTE_CHOICES[1].minutes);
  const act = useMutation({
    mutationFn: (work: () => Promise<unknown>) => work(),
    onSettled: () => client.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
  const list = (users.data ?? []).filter((user: UserView) => !filter || user.userName?.toLowerCase().includes(filter.toLowerCase()));
  const now = users.dataUpdatedAt;
  return (
    <div className={styles.block}>
      <div className={styles.toolbar}>
        <Field label="Find a player" value={filter} onChange={(event) => setFilter(event.target.value)} />
        <label className={styles.select}>
          <span>Mute or lock for</span>
          <select value={minutes} onChange={(event) => setMinutes(Number(event.target.value))}>
            {MUTE_CHOICES.map((choice) => <option key={choice.minutes} value={choice.minutes}>{choice.label}</option>)}
          </select>
        </label>
      </div>
      {act.error && <p className={styles.error}>{String(act.error)}</p>}
      <table className={styles.table}>
        <thead><tr><th>Player</th><th>Address</th><th>Status</th><th>Playing</th><th>Online for</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
        <tbody>
          {list.map((user) => {
            const name = user.userName ?? '';
            const muted = user.muteChatUntil && user.muteChatUntil > now;
            return (
              <tr key={user.sessionId || name}>
                <td>{name}{muted && <span className={styles.tag}>muted</span>}</td>
                <td>{user.host}</td>
                <td>{user.userState}</td>
                <td className={styles.clip}>{user.gameInfo}</td>
                <td>{user.timeConnected ? formatDuration(now - user.timeConnected) : ''}</td>
                <td className={styles.actions}>
                  <Button size="sm" variant="quiet" icon={<MicOff size={14} />} title={`Mute ${name}`}
                    onClick={() => act.mutate(() => api.adminMuteUser(name, minutes))}>Mute</Button>
                  <Button size="sm" variant="quiet" icon={<Ban size={14} />} title={`Lock ${name} out (accounts only)`}
                    onClick={() => act.mutate(() => api.adminLockUser(name, minutes))}>Lock</Button>
                  <Button size="sm" variant="quiet" icon={<Power size={14} />} title={`Deactivate ${name}'s account`}
                    onClick={() => window.confirm(`Deactivate ${name}? They can't sign in until you activate the account again.`) && act.mutate(() => api.adminActivateUser(name, false))}>Deactivate</Button>
                  <Button size="sm" variant="danger" icon={<LogOut size={14} />} title={`Disconnect ${name}`} disabled={!user.sessionId}
                    onClick={() => act.mutate(() => api.adminDisconnectUser(user.sessionId!))}>Disconnect</Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ReactivateForm api={api} />
    </div>
  );
}

function ReactivateForm({ api }: { api: AdminApi }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    await api.adminActivateUser(name.trim(), true);
    setNote(`${name.trim()} can sign in again.`);
    setName('');
  }
  return (
    <form className={styles.inline} onSubmit={submit}>
      <Field label="Activate an account" value={name} onChange={(event) => setName(event.target.value)} hint="Undoes Deactivate for a player who is offline." />
      <Button type="submit" size="sm" icon={<ShieldCheck size={15} />} disabled={!name.trim()}>Activate</Button>
      {note && <span className={styles.quiet} role="status">{note}</span>}
    </form>
  );
}

function TablesPanel({ api }: { api: AdminApi }) {
  const client = useQueryClient();
  const room = useQuery({ queryKey: ['admin', 'room'], queryFn: () => api.serverGetMainRoomId(), staleTime: Infinity });
  const tables = useQuery({
    queryKey: ['admin', 'tables', room.data],
    queryFn: () => api.roomGetAllTables(room.data!),
    enabled: !!room.data,
    refetchInterval: 5_000,
  });
  const remove = useMutation({
    mutationFn: (tableId: string) => api.adminTableRemove(tableId),
    onSettled: () => client.invalidateQueries({ queryKey: ['admin', 'tables'] }),
  });
  return (
    <table className={styles.table}>
      <thead><tr><th>Table</th><th>Host</th><th>Game</th><th>State</th><th>Seats</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
      <tbody>
        {(tables.data ?? []).map((table: TableView) => (
          <tr key={table.tableId}>
            <td>{table.tableName}</td>
            <td>{table.controllerName}</td>
            <td>{table.gameType} · {table.deckType}</td>
            <td>{table.tableStateText ?? table.tableState}</td>
            <td className={styles.clip}>{table.seatsInfo}</td>
            <td className={styles.actions}>
              <Button size="sm" variant="danger" icon={<Trash2 size={14} />}
                onClick={() => window.confirm(`Remove "${table.tableName}"? Its players lose the game.`) && remove.mutate(table.tableId!)}>Remove</Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Reports({ api }: { api: AdminApi }) {
  const client = useQueryClient();
  const [openOnly, setOpenOnly] = useState(true);
  const reports = useQuery({ queryKey: ['admin', 'reports', openOnly], queryFn: () => api.adminGetReports(openOnly), refetchInterval: 15_000 });
  const close = useMutation({
    mutationFn: ({ id, resolution }: { id: number; resolution: string }) => api.adminCloseReport(id, resolution),
    onSettled: () => client.invalidateQueries({ queryKey: ['admin', 'reports'] }),
  });
  const now = reports.dataUpdatedAt;
  return (
    <div className={styles.block}>
      <label className={styles.check}>
        <input type="checkbox" checked={!openOnly} onChange={(event) => setOpenOnly(!event.target.checked)} /> Show closed reports too
      </label>
      {reports.data?.length === 0 && <p className={styles.quiet}>{openOnly ? 'No reports are waiting.' : 'No reports yet.'}</p>}
      <ul className={styles.reports}>
        {(reports.data ?? []).map((report: PlayerReport) => (
          <li key={report.id} className={styles.report}>
            <p><strong>{report.reported}</strong> for <strong>{report.reason}</strong>, by {report.reporter} · {describeAge(report.createdAt ?? 0, now)}</p>
            {report.details && <blockquote>{report.details}</blockquote>}
            {report.gameId && <p className={styles.quiet}>Game {report.gameId}</p>}
            {report.open
              ? <CloseReport api={api} report={report} onClose={(resolution) => close.mutate({ id: report.id!, resolution })} />
              : <p className={styles.quiet}>Closed: {report.resolution || 'no note'}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CloseReport({ api, report, onClose }: { api: AdminApi; report: PlayerReport; onClose(resolution: string): void }) {
  const [note, setNote] = useState('');
  const name = report.reported ?? '';
  async function act(work: () => Promise<unknown>, done: string) {
    await work();
    onClose(note.trim() ? `${done}. ${note.trim()}` : done);
  }
  return (
    <div className={styles.inline}>
      <Field label="Note" value={note} onChange={(event) => setNote(event.target.value)} />
      <Button size="sm" onClick={() => act(() => api.adminMuteUser(name, 24 * 60), 'Muted for a day')}>Mute a day</Button>
      <Button size="sm" onClick={() => act(() => api.adminLockUser(name, 7 * 24 * 60), 'Locked out for a week')}>Lock a week</Button>
      <Button size="sm" variant="quiet" onClick={() => onClose(note.trim() || 'No action')}>Close, no action</Button>
    </div>
  );
}

function ClientErrors({ api }: { api: AdminApi }) {
  const errors = useQuery({ queryKey: ['admin', 'errors'], queryFn: () => api.adminClientErrors(), refetchInterval: 15_000 });
  const now = errors.dataUpdatedAt;
  if (errors.data?.length === 0) return <p className={styles.quiet}>No crash reports from web clients since the server started.</p>;
  return (
    <ul className={styles.reports}>
      {(errors.data ?? []).map((error: ClientError, index) => (
        <li key={index} className={styles.report}>
          <p><strong>{error.message}</strong>{(error.repeats ?? 0) > 0 && <span className={styles.tag}>×{(error.repeats ?? 0) + 1}</span>}</p>
          <p className={styles.quiet}>{error.userName ?? 'a visitor'} · {error.path} · {error.source} · {error.appVersion ?? 'dev'} · {describeAge(error.receivedAt ?? 0, now)}</p>
          {error.stack && <details><summary>Stack</summary><pre>{error.stack}</pre></details>}
          {error.context && <p className={styles.quiet}>{error.context}</p>}
        </li>
      ))}
    </ul>
  );
}

function Broadcast({ api }: { api: AdminApi }) {
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    await api.adminSendBroadcastMessage(message.trim());
    setSent(message.trim());
    setMessage('');
  }
  return (
    <form className={styles.signIn} onSubmit={submit}>
      <p className={styles.lede}>Every connected player sees this as a message from the server. Start it with “warn” to show it in red.</p>
      <Field label="Message" value={message} maxLength={500} onChange={(event) => setMessage(event.target.value)} />
      <Button type="submit" variant="decision" disabled={!message.trim()}>Send to everyone</Button>
      {sent && <p className={styles.quiet} role="status">Sent: {sent}</p>}
    </form>
  );
}
