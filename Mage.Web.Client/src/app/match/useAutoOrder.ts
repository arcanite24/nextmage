import { useEffect } from 'react';
import { autoOrderPick } from '../../core/game/autoAnswer';
import type { GameSession, GameSessionState } from '../../core/game/gameSession';
import { useAutoAnswers } from '../stores/autoAnswers';

/**
 * While "Order automatically" is on, answers each trigger-order question of the batch with the first trigger, and
 * turns itself off at the next other decision.
 */
export function useAutoOrder(session: GameSession, state: GameSessionState) {
  const { gameId, prompt, awaitingServer } = state;
  const on = useAutoAnswers((answers) => !!answers.autoOrdering[gameId]);
  useEffect(() => {
    if (!on || !prompt || awaitingServer) return;
    const pick = autoOrderPick(prompt);
    if (pick) void session.respond({ type: 'uuid', id: pick }).catch(() => undefined);
    else useAutoAnswers.getState().setAutoOrdering(gameId, false);
  }, [on, prompt, awaitingServer, session, gameId]);
  // the server forgets standing answers with the game
  useEffect(() => () => useAutoAnswers.getState().forgetGame(gameId), [gameId]);
}
