import { useEffect, useState } from 'react';
import { api } from '../connection';
import { useSession } from '../stores/session';

export const WATCHERS_POLL_MS = 10_000;

/** Who is watching a live game, refreshed while it is on screen. */
export function useWatchers(gameId: string, enabled: boolean): string[] {
  const [watchers, setWatchers] = useState<string[]>([]);
  const connected = useSession((state) => state.connection === 'open');
  useEffect(() => {
    if (!enabled || !connected) return;
    let cancelled = false;
    const look = () => {
      api.gameWatchers(gameId)
        .then((names) => { if (!cancelled) setWatchers(names ?? []); })
        // an older server without the call: no count
        .catch(() => undefined);
    };
    look();
    const timer = setInterval(look, WATCHERS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [gameId, enabled, connected]);
  return watchers;
}
