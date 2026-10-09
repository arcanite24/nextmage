import { useStore } from 'zustand';
import type { GameSession } from '../../core/game/gameSession';
import { matchProgress } from '../../core/game/matchProgress';
import { gameResult, type GameResult } from '../../core/game/matchResult';
import { useT, type MessageKey } from '../i18n';
import { useGames } from '../stores/games';
import { useSession } from '../stores/session';
import './matchMessages';
import styles from './MatchScore.module.css';

const LINES: Record<GameResult, MessageKey> = { won: 'match.score.won', lost: 'match.score.lost', draw: 'match.score.draw' };

/**
 * Sideboarding between games: how the last game went and the match score ("You won game 1 · 1–0"), from the game
 * of this table the player just finished. Nothing when that game isn't known here (a reload in between).
 */
export function MatchScore({ tableId }: { tableId: string }) {
  const session = useGames((state) => {
    const ids = Object.keys(state.tables).filter((id) => state.tables[id].tableId === tableId || state.tables[id].parentTableId === tableId);
    const id = state.latestGameId && ids.includes(state.latestGameId) ? state.latestGameId : ids[ids.length - 1];
    return id ? state.sessions[id] ?? null : null;
  });
  return session ? <Score session={session} /> : null;
}

function Score({ session }: { session: GameSession }) {
  const t = useT();
  const endInfo = useStore(session.store, (state) => state.endInfo);
  const gameOver = useStore(session.store, (state) => state.gameOver);
  const myName = useSession((state) => state.userName);
  const progress = matchProgress(endInfo);
  const result = gameOver ? gameResult(gameOver, endInfo, myName) : null;
  if (!progress || !result) return null;
  return (
    <p className={styles.score} role="status">
      {t(LINES[result], { game: progress.gameNumber, wins: progress.wins, losses: progress.losses })}
    </p>
  );
}
