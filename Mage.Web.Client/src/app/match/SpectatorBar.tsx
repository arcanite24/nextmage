import { Eye } from 'lucide-react';
import type { GameSession, GameSessionState } from '../../core/game/gameSession';
import { Button } from '../ui/Button';
import { useWatchers } from './useWatchers';
import styles from './SpectatorBar.module.css';

/** The eye and the number of people watching; their names on hover. */
export function WatcherCount({ watchers, className }: { watchers: string[]; className?: string }) {
  if (watchers.length === 0) return null;
  const label = `${watchers.length} watching: ${watchers.join(', ')}`;
  return (
    <span className={[styles.count, className ?? ''].join(' ')} title={label} aria-label={label} role="status">
      <Eye size={22} aria-hidden="true" />
      {watchers.length}
    </span>
  );
}

/** Watching or replaying: whose seat to see the table from, who else is watching, and the way out. */
export function SpectatorBar({ session, state, onLeave }: { session: GameSession; state: GameSessionState; onLeave(): void }) {
  const players = state.view?.players ?? [];
  const watchers = useWatchers(state.gameId, state.mode === 'watch' && !state.gameOver);
  const seat = state.playerId ?? players[0]?.playerId ?? '';
  return (
    <div className={styles.bar}>
      <p className={styles.mode}>{state.mode === 'watch' ? 'Watching' : 'Replay'}</p>
      {players.length > 1 && (
        <label className={styles.seat}>
          <span>Seat</span>
          <select value={seat} onChange={(event) => session.setPerspective(event.target.value || null)}>
            {players.map((player) => <option key={player.playerId} value={player.playerId}>{player.name}</option>)}
          </select>
        </label>
      )}
      <WatcherCount watchers={watchers} />
      <Button variant="print" onClick={onLeave}>Leave</Button>
    </div>
  );
}
