import { Users } from 'lucide-react';
import { useLobby } from '../stores/lobby';
import styles from './LobbyDrawer.module.css';

/** The rail's lobby button: who's online, and unread chat. */
export function LobbyButton() {
  const open = useLobby((state) => state.open);
  const unread = useLobby((state) => state.unread);
  const online = useLobby((state) => state.users.length);
  const setOpen = useLobby((state) => state.setOpen);
  return (
    <button
      type="button"
      className={styles.button}
      aria-pressed={open}
      aria-label={`Lobby: ${online} online${unread ? `, ${unread} unread` : ''}`}
      onClick={() => setOpen(!open)}
    >
      <Users size={18} aria-hidden="true" />
      <span>{online || ''}</span>
      {unread > 0 && <span className={styles.unread} aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
    </button>
  );
}
