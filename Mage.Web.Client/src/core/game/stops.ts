import type { UserSkipPrioritySteps } from '../../protocol/generated/views';

const EVERY_STEP = { upkeep: true, draw: true, main1: true, beforeCombat: true, endOfCombat: true, main2: true, endOfTurn: true };

/**
 * The stops the server should use: the player's own, or every one of them under full control. With auto-pass on, the
 * server also stops at the player's own beginning of combat: the server skips steps without looking at the board, so
 * only the client can see a Vehicle to crew there (core/game/autoPass passes the stop when there is none).
 */
export function serverStops(stops: UserSkipPrioritySteps, fullControl: boolean, autoPass = false): UserSkipPrioritySteps {
  if (!fullControl) {
    return autoPass && !stops.yourTurn?.beforeCombat ? { ...stops, yourTurn: { ...stops.yourTurn, beforeCombat: true } } : stops;
  }
  return {
    ...stops,
    yourTurn: EVERY_STEP,
    opponentTurn: EVERY_STEP,
    stopOnDeclareAttackers: true,
    stopOnDeclareBlockersWithZeroPermanents: true,
    stopOnDeclareBlockersWithAnyPermanents: true,
    stopOnAllMainPhases: true,
    stopOnAllEndPhases: true,
    stopOnStackNewObjects: true,
  };
}
