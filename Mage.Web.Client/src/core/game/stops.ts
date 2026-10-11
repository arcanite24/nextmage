import type { UserSkipPrioritySteps } from '../../protocol/generated/views';

const EVERY_STEP = { upkeep: true, draw: true, main1: true, beforeCombat: true, endOfCombat: true, main2: true, endOfTurn: true };

/**
 * The stops the server should use: the player's own, or every one of them under full control. The server also stops
 * at the player's own beginning of combat, auto-pass on or off: the server skips steps without looking at the board,
 * so only the client can see a Vehicle to crew there (Greasefang returns one at that very moment). Unless the player
 * set that stop themselves, core/game/autoPass passes it when there is nothing to crew or animate.
 */
export function serverStops(stops: UserSkipPrioritySteps, fullControl: boolean): UserSkipPrioritySteps {
  if (!fullControl) {
    return stops.yourTurn?.beforeCombat ? stops : { ...stops, yourTurn: { ...stops.yourTurn, beforeCombat: true } };
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
