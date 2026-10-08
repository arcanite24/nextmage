import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from 'zustand';
import { useEvents } from '../stores/events';
import { useGames } from '../stores/games';
import { MatchErrorBoundary } from '../match/MatchErrorBoundary';
import { MatchStage } from '../match/MatchStage';
import { Button } from '../ui/Button';
import styles from './GameScreen.module.css';

/** A running game: the match stage, full screen. */
export function GameScreen() {
  const { gameId = '' } = useParams();
  const navigate = useNavigate();
  const session = useGames((state) => state.sessions[gameId]);
  // games inside an event lead back to the event
  const eventId = useEvents((events) => events.currentTournamentId);

  if (!session) {
    return (
      <div className={styles.missing}>
        <h1>This game isn't open here</h1>
        <p>It may have ended, or it was started in another tab.</p>
        <Button variant="print" onClick={() => navigate('/')}>Back to Play</Button>
      </div>
    );
  }
  return (
    <MatchErrorBoundary
      gameId={gameId}
      backLabel={eventId ? 'Back to the event' : 'Back to Play'}
      onBack={() => navigate(eventId ? `/event/${eventId}` : '/')}
    >
      {/* each game of a match gets a fresh stage */}
      <ConnectedStage key={gameId} gameId={gameId} />
    </MatchErrorBoundary>
  );
}

function ConnectedStage({ gameId }: { gameId: string }) {
  const session = useGames((state) => state.sessions[gameId])!;
  const state = useStore(session.store);
  return <MatchStage session={session} state={state} />;
}
