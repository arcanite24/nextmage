import type { GameView } from '../../protocol/generated/views';
import { myAttackers, myBlockers } from './interaction';
import type { Prompt } from './prompt';

/**
 * Arena-style smart passing, decided on the client. The server asks for priority at every stop; when the player
 * has nothing real to do there, the client answers for them. "Real" means a spell to cast, a land to play or a
 * non-mana ability to activate: a land that can only tap for mana is not a reason to stop.
 */

/** Where the player wants priority in combat on one side's turn (the server always offers it there). */
export interface CombatStops {
  /** after attackers are declared */
  attackers: boolean;
  /** after blockers are declared */
  blockers: boolean;
}

export interface TurnCombatStops {
  yourTurn: CombatStops;
  opponentTurn: CombatStops;
}

/** True when the player asked to stop in this combat step: there are attackers, and the stop is set for this turn. */
export function combatStopHere(view: GameView | null | undefined, stops: TurnCombatStops | null | undefined): boolean {
  if (!view || !stops) return false;
  const step = view.step === 'DECLARE_ATTACKERS' ? 'attackers' : view.step === 'DECLARE_BLOCKERS' ? 'blockers' : null;
  if (!step) return false;
  if (!(view.combat ?? []).some((group) => Object.keys(group.attackers ?? {}).length > 0)) return false;
  const myTurn = !!view.myPlayerId && view.activePlayerId === view.myPlayerId;
  return !!(myTurn ? stops.yourTurn : stops.opponentTurn)?.[step];
}

export interface AutoPassSettings {
  /** pass priority when nothing can be played */
  autoPass: boolean;
  /** answer "no attacks" / "no blocks" when no creature can attack or block */
  autoSkipCombat: boolean;
  /** on the opponent's turn, permanents' activated abilities count as something to do (instants always do) */
  abilitiesOnTheirTurn: boolean;
  /** Arena's full control: the client never answers for the player */
  fullControl?: boolean;
  /** combat steps where the player wants to stop */
  combatStops?: TurnCombatStops;
  /** the player's own stop at the beginning of their combat (the server always stops there, see serverStops) */
  beginCombatStop?: boolean;
  /** a beginning-of-combat trigger went on the stack this turn */
  combatTriggered?: boolean;
}

/**
 * A mana ability the server lists among "other" abilities (dual lands, "any color" sources): its text is only a
 * cost and "Add ...".
 */
function isManaText(text: string | undefined): boolean {
  return !!text && /^[^:]*:\s*Add\b[^.]*\.?$/i.test(text.replace(/<[^>]*>/g, '').trim());
}

/** Objects with something to do besides making mana; optionally only spells and land plays. */
export function meaningfulPlays(view: GameView | null | undefined, includeAbilities = true): string[] {
  const objects = view?.canPlayObjects?.objects ?? {};
  return Object.entries(objects)
    .filter(([, stats]) => (stats.basicCastAbilities?.length ?? 0) + (stats.basicPlayAbilities?.length ?? 0)
      + (includeAbilities ? (stats.other ?? []).filter((record) => !isManaText(record.value)).length : 0) > 0)
    .map(([id]) => id);
}

/** Combat steps after attackers are declared: with nobody attacking there is nothing to respond to in them. */
const AFTER_ATTACKS = new Set(['DECLARE_ATTACKERS', 'DECLARE_BLOCKERS', 'FIRST_COMBAT_DAMAGE', 'COMBAT_DAMAGE', 'END_COMBAT']);

function noCombat(view: GameView): boolean {
  return AFTER_ATTACKS.has(view.step ?? '')
    && Object.keys(view.stack ?? {}).length === 0
    && !(view.combat ?? []).some((group) => Object.keys(group.attackers ?? {}).length > 0);
}

/**
 * The beginning of your combat with an empty stack, when the player has no stop there: passed, unless a trigger there
 * just resolved and left something to do before attacks (crew the vehicle Greasefang returned).
 */
function skipBeginCombat(view: GameView, settings: AutoPassSettings): boolean {
  if (settings.beginCombatStop !== false || view.step !== 'BEGIN_COMBAT') return false;
  if (!view.myPlayerId || view.activePlayerId !== view.myPlayerId) return false;
  if (Object.keys(view.stack ?? {}).length > 0) return false;
  return !(settings.combatTriggered && meaningfulPlays(view).length > 0);
}

export type AutoAnswer = 'pass' | 'noAttacks' | 'noBlocks';

/** What to answer for the player right now, or null when the decision is theirs. */
export function autoAnswer(view: GameView | null | undefined, prompt: Prompt | null, settings: AutoPassSettings): AutoAnswer | null {
  if (!view || !prompt || settings.fullControl) return null;
  switch (prompt.kind) {
    case 'priority':
    {
      if (skipBeginCombat(view, settings)) return 'pass';
      if (!settings.autoPass) return null;
      if (combatStopHere(view, settings.combatStops)) return null;
      // like Arena: when no creature attacks, the rest of combat goes by even with instants in hand
      if (settings.autoSkipCombat && noCombat(view)) return 'pass';
      const myTurn = !!view.myPlayerId && view.activePlayerId === view.myPlayerId;
      return meaningfulPlays(view, myTurn || settings.abilitiesOnTheirTurn).length === 0 ? 'pass' : null;
    }
    // the server stops listing creatures once they are declared: with everything chosen the list is empty too, and
    // that declaration is the player's to confirm
    case 'declareAttackers':
      return settings.autoSkipCombat && prompt.possibleAttackers.length === 0 && myAttackers(view).length === 0 ? 'noAttacks' : null;
    case 'declareBlockers':
      return settings.autoSkipCombat && prompt.possibleBlockers.length === 0 && myBlockers(view).length === 0 ? 'noBlocks' : null;
    default:
      return null;
  }
}
