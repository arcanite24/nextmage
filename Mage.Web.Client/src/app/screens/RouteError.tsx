import { useRouteError } from 'react-router-dom';
import { Button } from '../ui/Button';
import styles from './GameScreen.module.css';

/** Shown instead of a screen that crashed: what happened, and a way back. */
export function RouteError() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
  return (
    <div className={styles.missing} role="alert">
      <h1>Something broke</h1>
      <p>This screen hit an error and stopped. Your games and decks are safe.</p>
      <p><code>{message}</code></p>
      <div style={{ display: 'flex', gap: 12 }}>
        <Button variant="print" onClick={() => window.location.reload()}>Reload</Button>
        <Button variant="print" onClick={() => window.location.assign('/')}>Back to Play</Button>
      </div>
    </div>
  );
}
