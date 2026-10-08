import { useState } from 'react';
import type { MatchProgress } from '../../core/game/matchProgress';
import { Button } from '../ui/Button';
import styles from './BetweenGames.module.css';

/**
 * The pause between games of a match: the result, the score, and the next game on its way. The server starts the
 * next game (or sideboarding) by itself, and the client follows; leaving here gives up the rest of the match.
 */
export function BetweenGames({ progress, won, onLeave, leaveLabel = 'Leave match', concedes = true }: {
  progress: MatchProgress;
  /** null for a draw */
  won: boolean | null;
  onLeave(): void;
  leaveLabel?: string;
  /** leaving gives up the rest of the match (not in events, where the event decides) */
  concedes?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const result = won === null ? 'Draw' : won ? 'You won' : 'You lost';
  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" aria-labelledby="between-games-title">
      <div className={styles.center}>
        <p className={styles.kicker}>Game {progress.gameNumber} of {progress.bestOf}</p>
        <h2 id="between-games-title" className={[styles.title, won ? styles.won : ''].join(' ')}>{result}</h2>
        <p className={styles.score} aria-label={`Match score ${progress.wins} to ${progress.losses}`}>
          <span>{progress.wins}</span>
          <span className={styles.dash}>–</span>
          <span>{progress.losses}</span>
        </p>
        <p className={styles.next} role="status">
          Next game starting<span className={styles.dots} aria-hidden="true" />
        </p>
        <p className={styles.hint}>First to {progress.winsNeeded} wins takes the match.</p>
        <div className={styles.leave}>
          {confirming ? (
            <>
              <span>Leave and concede the rest of the match?</span>
              <Button variant="quiet" size="sm" onClick={() => setConfirming(false)}>Stay</Button>
              <Button variant="danger" size="sm" onClick={onLeave}>{leaveLabel}</Button>
            </>
          ) : (
            <Button variant="quiet" size="sm" onClick={() => (concedes ? setConfirming(true) : onLeave())}>{leaveLabel}</Button>
          )}
        </div>
      </div>
    </div>
  );
}
