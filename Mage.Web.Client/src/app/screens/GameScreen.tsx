import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from 'zustand';
import { useGames } from '../stores/games';
import { MatchStage } from '../match/MatchStage';
import { Button } from '../ui/Button';
import styles from './GameScreen.module.css';

/** A running game: the match stage, full screen. */
export function GameScreen() {
  const { gameId = '' } = useParams();
  const navigate = useNavigate();
  const session = useGames((state) => state.sessions[gameId]);

  if (!session) {
    return (
      <div className={styles.missing}>
        <h1>This game isn't open here</h1>
        <p>It may have ended, or it was started in another tab.</p>
        <Button variant="print" onClick={() => navigate('/')}>Back to Play</Button>
      </div>
    );
  }
  return <ConnectedStage gameId={gameId} />;
}

function ConnectedStage({ gameId }: { gameId: string }) {
  const session = useGames((state) => state.sessions[gameId])!;
  const state = useStore(session.store);
  return <MatchStage session={session} state={state} />;
}
