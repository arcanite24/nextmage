import type { GameView } from '../../protocol/generated/views';
import type { InteractionMode } from './interaction';

/**
 * The guided first game: one short tip for each new kind of moment, shown the first time it comes up. Arena teaches
 * by playing; so does this. The tips are in the order a first game meets them.
 */
export type CoachTip =
  | 'mulligan'
  | 'playLand'
  | 'castSpell'
  | 'payMana'
  | 'toCombat'
  | 'attack'
  | 'block'
  | 'target'
  | 'respond'
  | 'theirTurn';

export const COACH_TIPS: CoachTip[] = ['mulligan', 'playLand', 'castSpell', 'payMana', 'toCombat', 'attack', 'block', 'target', 'respond', 'theirTurn'];

export interface CoachMoment {
  view: GameView | null | undefined;
  mode: InteractionMode;
  /** true while a sent answer is on its way: the moment is about to change */
  awaiting: boolean;
}

const MAIN_STEPS = new Set(['PRECOMBAT_MAIN', 'POSTCOMBAT_MAIN']);

function inHand(view: GameView, id: string) {
  return view.myHand?.[id];
}

/** The tips this moment calls for, most specific first. */
export function tipsFor({ view, mode, awaiting }: CoachMoment): CoachTip[] {
  if (!view || awaiting) return [];
  const tips: CoachTip[] = [];
  const myId = view.myPlayerId;
  const myTurn = !!myId && view.activePlayerId === myId;
  switch (mode) {
    case 'mulligan':
      return ['mulligan'];
    case 'payMana':
      return ['payMana'];
    case 'declareAttackers':
      return ['attack'];
    case 'declareBlockers':
      return ['block'];
    case 'target':
    case 'pickCards':
      return ['target'];
    case 'waiting':
      return myTurn ? [] : ['theirTurn'];
    case 'priority':
      break;
    default:
      return [];
  }
  const playable = Object.keys(view.canPlayObjects?.objects ?? {}).map((id) => inHand(view, id)).filter((card) => !!card);
  const stackSize = Object.keys(view.stack ?? {}).length;
  if (stackSize > 0 && !myTurn) tips.push('respond');
  if (myTurn && MAIN_STEPS.has(view.step ?? '')) {
    if (playable.some((card) => (card.cardTypes ?? []).includes('LAND'))) tips.push('playLand');
    if (playable.some((card) => !(card.cardTypes ?? []).includes('LAND'))) tips.push('castSpell');
    const me = view.players?.find((player) => player.playerId === myId);
    const readyCreature = Object.values(me?.battlefield ?? {}).some((permanent) =>
      (permanent.cardTypes ?? []).includes('CREATURE') && !permanent.tapped && !permanent.summoningSickness);
    if (view.step === 'PRECOMBAT_MAIN' && readyCreature && stackSize === 0) tips.push('toCombat');
  }
  return tips;
}

/** The first tip of this moment the player hasn't seen yet, or null. */
export function nextTip(moment: CoachMoment, seen: ReadonlySet<CoachTip>): CoachTip | null {
  return tipsFor(moment).find((tip) => !seen.has(tip)) ?? null;
}
