import { useEffect, useState } from 'react';
import { autoAnswer, type AutoAnswer } from '../../core/game/autoPass';
import type { Command } from '../../core/game/interaction';
import type { GameSession, GameSessionState } from '../../core/game/gameSession';
import { useSettings } from '../stores/settings';

/** Long enough to see what changed on the board, short enough not to feel like waiting. */
const BEAT_MS = 280;

const COMMANDS: Record<AutoAnswer, Command> = {
  pass: { type: 'boolean', value: false },
  // confirming the declaration with nothing chosen
  noAttacks: { type: 'boolean', value: true },
  noBlocks: { type: 'boolean', value: true },
};

/**
 * Answers for the player when they have nothing to decide (see core/game/autoPass): passing priority with nothing
 * to play, declaring no attacks or blocks when nothing can. Holding priority turns it off. Returns what it is about
 * to answer, so the decision corner can say so.
 */
export function useAutoPass(session: GameSession, state: GameSessionState, enabled: boolean): AutoAnswer | null {
  const autoPass = useSettings((store) => store.settings.autoPass);
  const autoSkipCombat = useSettings((store) => store.settings.autoSkipCombat);
  const abilitiesOnTheirTurn = useSettings((store) => store.settings.abilitiesOnTheirTurn);
  const combatStops = useSettings((store) => store.settings.combatStops);
  const fullControl = useSettings((store) => store.fullControl);
  const beginCombatStop = useSettings((store) => store.settings.stops.yourTurn?.beforeCombat);
  // the last turn whose beginning of combat had something on the stack: once it resolves, the player may need the step
  const view = state.view;
  const [triggeredTurn, setTriggeredTurn] = useState<number | null>(null);
  const stackedTurn = view?.step === 'BEGIN_COMBAT' && Object.keys(view.stack ?? {}).length > 0 ? view.turn ?? null : null;
  if (stackedTurn !== null && stackedTurn !== triggeredTurn) setTriggeredTurn(stackedTurn);
  const combatTriggered = view?.turn != null && (stackedTurn ?? triggeredTurn) === view.turn;
  const answer = enabled && state.mode === 'play' && !state.awaitingServer && !state.gameOver
    ? autoAnswer(view, state.prompt, { autoPass, autoSkipCombat, abilitiesOnTheirTurn, fullControl, combatStops, beginCombatStop, combatTriggered })
    : null;

  useEffect(() => {
    if (!answer) return;
    const timer = setTimeout(() => {
      void session.respond(COMMANDS[answer]).catch(() => undefined);
    }, BEAT_MS);
    return () => clearTimeout(timer);
  }, [answer, session, state.prompt]);

  return answer;
}
