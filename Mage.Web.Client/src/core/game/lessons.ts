import type { GameView } from '../../protocol/generated/views';
import type { InteractionMode } from './interaction';

/**
 * A school's coaching in the game: each tip has a moment (`on`) and shows once, the first time that moment comes.
 * The triggers are the ones CURRICULUM.md lists for the schools' writers.
 */
export interface LessonTip {
  on?: string;
  title?: string;
  text?: string;
}

export interface LessonMoment {
  view: GameView | null | undefined;
  mode: InteractionMode;
  /** true while a sent answer is on its way: the moment is about to change */
  awaiting: boolean;
}

function names(cards: Record<string, { name?: string }> | undefined): string[] {
  return Object.values(cards ?? {}).map((card) => (card.name ?? '').toLowerCase());
}

function threshold(value: string): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

/** Your turn's number, counting only your turns (1 on your first). */
export function myTurnNumber(view: GameView): number | null {
  const myId = view.myPlayerId;
  if (!myId || view.activePlayerId !== myId || !view.turn) return null;
  const seats = Math.max(1, view.players?.length ?? 2);
  return Math.ceil(view.turn / seats);
}

/** Whether a tip's moment is now. An unknown trigger never fires. */
export function triggered(on: string, { view, mode, awaiting }: LessonMoment): boolean {
  if (!view || awaiting) return false;
  const colon = on.indexOf(':');
  const kind = colon < 0 ? on : on.slice(0, colon);
  const arg = colon < 0 ? '' : on.slice(colon + 1).trim();
  const myId = view.myPlayerId;
  const me = view.players?.find((player) => player.playerId === myId);
  const deciding = mode !== 'waiting' && mode !== 'panel';
  switch (kind) {
    case 'start':
      return deciding;
    case 'mulligan':
      return mode === 'mulligan';
    case 'attack':
      return mode === 'declareAttackers';
    case 'block':
      return mode === 'declareBlockers';
    case 'turn':
      return deciding && myTurnNumber(view) === threshold(arg);
    case 'cast':
      return names(view.stack).includes(arg.toLowerCase());
    case 'play':
      return (view.players ?? []).some((player) => names(player.battlefield).includes(arg.toLowerCase()));
    case 'opponentSpell':
      return mode === 'priority' && Object.values(view.stack ?? {}).some((card) => !!card.controllerId && card.controllerId !== myId);
    case 'life':
      return me?.life != null && me.life <= threshold(arg);
    case 'opponentLife':
      return (view.players ?? []).some((player) => player.playerId !== myId && player.life != null && player.life <= threshold(arg));
    case 'graveyard':
      return Object.keys(me?.graveyard ?? {}).length >= threshold(arg);
    default:
      return false;
  }
}

/** The first tip whose moment is now and that hasn't shown this game, as its index; null when none. */
export function dueTip(tips: readonly LessonTip[], moment: LessonMoment, shown: ReadonlySet<number>): number | null {
  for (let index = 0; index < tips.length; index++) {
    const on = tips[index].on;
    if (!shown.has(index) && on && triggered(on, moment)) return index;
  }
  return null;
}
