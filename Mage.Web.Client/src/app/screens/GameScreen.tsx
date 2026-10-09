import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from 'zustand';
import { useEvents } from '../stores/events';
import { useGames } from '../stores/games';
import { usePlay } from '../stores/play';
import { MatchErrorBoundary } from '../match/MatchErrorBoundary';
import { MatchStage } from '../match/MatchStage';
import { ReconnectScrim } from '../match/ReconnectScrim';
import { useSession } from '../stores/session';
import { Button } from '../ui/Button';
import styles from './GameScreen.module.css';

/** A running game: the match stage, full screen. */
export function GameScreen() {
  const { gameId = '' } = useParams();
  const navigate = useNavigate();
  const session = useGames((state) => state.sessions[gameId]);
  // games inside an event lead back to the event
  const eventId = useEvents((events) => events.currentTournamentId);
  // Career matches lead back to Career (a mode's game to that mode's screen)
  const returnPath = usePlay((play) => play.returnPath) ?? '/';
  const backLabel = eventId ? 'Back to the event' : returnPath.startsWith('/career') ? 'Back to Career' : 'Back to Play';

  if (!session) {
    return (
      <div className={styles.missing}>
        <h1>This game isn't open here</h1>
        <p>It may have ended, or it was started in another tab.</p>
        <Button variant="print" onClick={() => navigate(returnPath)}>{backLabel}</Button>
      </div>
    );
  }
  return (
    <MatchErrorBoundary
      gameId={gameId}
      backLabel={backLabel}
      onBack={() => navigate(eventId ? `/event/${eventId}` : returnPath)}
    >
      {/* each game of a match gets a fresh stage */}
      <ConnectedStage
        key={gameId}
        gameId={gameId}
        leaveLabel={backLabel}
        onLeave={() => {
          useGames.getState().close(gameId);
          navigate(eventId ? `/event/${eventId}` : returnPath);
        }}
      />
    </MatchErrorBoundary>
  );
}

function ConnectedStage({ gameId, leaveLabel, onLeave }: { gameId: string; leaveLabel: string; onLeave(): void }) {
  const session = useGames((state) => state.sessions[gameId])!;
  const state = useStore(session.store);
  const connection = useSession((session) => session.connection);
  const offline = connection !== 'open';
  return (
    <>
      <MatchStage session={session} state={state} />
      {(offline || state.resyncing) && !state.gameOver && state.mode !== 'replay' && (
        <ReconnectScrim offline={offline} onLeave={onLeave} leaveLabel={leaveLabel} />
      )}
    </>
  );
}
