import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, UserPlus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { createApi } from '../../protocol/generated/api';
import type { StaffMember } from '../../protocol/generated/views';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { ConfirmAction } from './ConfirmAction';
import { formatDate, type StaffRole } from './adminFormat';
import styles from './AdminScreen.module.css';

type AdminApi = ReturnType<typeof createApi>;

const STAFF_KEY = ['admin', 'staff'];

const ROLES: { id: StaffRole; can: string }[] = [
  { id: 'moderator', can: 'players (mute, sign out), reports, audit, stats, client errors' },
  { id: 'admin', can: 'also locks, accounts, tables, broadcasts and access' },
  { id: 'owner', can: 'also staff roles' },
];

/** Who has a staff role, for the owner to give and take away. */
export function StaffPage({ api, actor }: { api: AdminApi; actor: string }) {
  const client = useQueryClient();
  const staff = useQuery({ queryKey: STAFF_KEY, queryFn: () => api.adminStaff() });
  const [revoking, setRevoking] = useState<StaffMember | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => client.invalidateQueries({ queryKey: STAFF_KEY });

  async function change(name: string, role: string) {
    setError(null);
    try {
      await api.adminStaffGrant(name, role);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  if (staff.error) return <p className={styles.error}>{String(staff.error)}</p>;
  if (!staff.data) return <p className={styles.quiet}>Loading…</p>;
  const { owner, members = [], accounts } = staff.data;
  return (
    <div className={styles.overview}>
      <section className={styles.block} aria-labelledby="staff-head">
        <h2 id="staff-head">Staff</h2>
        <ul className={styles.roleKey}>
          {ROLES.map((role) => <li key={role.id}><strong>{role.id}</strong>: {role.can}</li>)}
        </ul>
        {!accounts && <p className={styles.alarm}>This server has no accounts (XMAGE_AUTH=false), so roles do nothing: anyone could take a staff member's name.</p>}
        {revoking && (
          <ConfirmAction title={`Take ${revoking.name}'s role away`} what={`${revoking.name} loses Admin at once and plays as a player.`}
            confirmLabel="Take away" onCancel={() => setRevoking(null)}
            onConfirm={async (reason) => {
              await api.adminStaffRevoke(revoking.name!, reason);
              setRevoking(null);
              await refresh();
            }} />
        )}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <table className={styles.table}>
          <thead><tr><th>Account</th><th>Role</th><th>Given by</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
          <tbody>
            {owner && (
              <tr>
                <td>{owner}</td>
                <td><span className={styles.chip}><Crown size={13} aria-hidden="true" /> owner</span></td>
                <td className={styles.quiet}>XMAGE_OWNER, fixed</td>
                <td />
              </tr>
            )}
            {members.map((member) => (
              <tr key={member.key}>
                <td>{member.name}{member.name?.toLowerCase() === actor.toLowerCase() && <span className={styles.tag}>you</span>}</td>
                <td>
                  <select aria-label={`${member.name}'s role`} value={member.role} onChange={(event) => void change(member.name!, event.target.value)}>
                    {ROLES.map((role) => <option key={role.id} value={role.id}>{role.id}</option>)}
                  </select>
                </td>
                <td className={styles.quiet}>{member.grantedBy} · {formatDate(member.grantedAt ?? 0)}</td>
                <td className={styles.actions}>
                  <Button size="sm" variant="quiet" icon={<X size={14} />} onClick={() => setRevoking(member)}>Take away</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.length === 0 && !owner && <p className={styles.quiet}>Nobody has a role yet; only the console can manage this server.</p>}
      </section>
      <Grant api={api} onGranted={refresh} />
    </div>
  );
}

function Grant({ api, onGranted }: { api: AdminApi; onGranted(): void }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRole>('moderator');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.adminStaffGrant(name.trim(), role, reason.trim() || null);
      setName('');
      setReason('');
      onGranted();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.block} aria-labelledby="grant-head">
      <h2 id="grant-head">Give a role</h2>
      <form className={styles.inline} onSubmit={submit}>
        <Field label="Account" value={name} onChange={(event) => setName(event.target.value)} spellCheck={false} required />
        <label className={styles.select}>
          <span>Role</span>
          <select value={role} onChange={(event) => setRole(event.target.value as StaffRole)}>
            {ROLES.map((r) => <option key={r.id} value={r.id}>{r.id}</option>)}
          </select>
        </label>
        <Field label="Reason (optional)" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
        <Button type="submit" size="sm" variant="decision" icon={<UserPlus size={15} />} busy={busy} disabled={!name.trim()}>Give role</Button>
      </form>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  );
}
