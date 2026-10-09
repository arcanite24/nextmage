import type { UserSkipPrioritySteps } from '../../protocol/generated/views';

const EVERY_STEP = { upkeep: true, draw: true, main1: true, beforeCombat: true, endOfCombat: true, main2: true, endOfTurn: true };

/**
 * The stops the server should use: the player's own, or every one of them under full control. The beginning of your
 * combat is always a server stop: what a trigger there brings back (Greasefang's vehicle) is crewed in that step, so
 * the client keeps the player's own choice for it instead (see autoAnswer).
 */
export function serverStops(stops: UserSkipPrioritySteps, fullControl: boolean): UserSkipPrioritySteps {
  if (!fullControl) return { ...stops, yourTurn: { ...stops.yourTurn, beforeCombat: true } };
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
