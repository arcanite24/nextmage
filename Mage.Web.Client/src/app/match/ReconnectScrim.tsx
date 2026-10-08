import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import styles from './ReconnectScrim.module.css';

/** After this long the scrim also offers a way out, in case the game never comes back. */
const LEAVE_AFTER_MS = 20_000;

/**
 * Covers the board while it can't be trusted: the connection is down, or the server hasn't sent the game back yet
 * (after a reload or a reconnect). The game keeps running on the server meanwhile.
 */
export function ReconnectScrim({ offline, onLeave, leaveLabel }: { offline: boolean; onLeave(): void; leaveLabel: string }) {
  const [canLeave, setCanLeave] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setCanLeave(true), LEAVE_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className={styles.scrim} role="alertdialog" aria-modal="true" aria-labelledby="reconnect-title" aria-describedby="reconnect-detail">
      <div className={styles.panel}>
        <span className={styles.pulse} aria-hidden="true" />
        <h2 id="reconnect-title" className={styles.title}>{offline ? 'Reconnecting…' : 'Rejoining the game…'}</h2>
        <p id="reconnect-detail" className={styles.detail}>
          {offline
            ? 'The connection to the server dropped. Your game is kept on the server; you will be back at the table as soon as it returns.'
            : 'Getting the table back from the server.'}
        </p>
        {canLeave && <Button variant="quiet" size="sm" onClick={onLeave}>{leaveLabel}</Button>}
      </div>
    </div>
  );
}
