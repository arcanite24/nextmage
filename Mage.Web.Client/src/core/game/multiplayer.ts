import type { GameView, PermanentView, PlayerView } from '../../protocol/generated/views';
import type { Prompt } from './prompt';

/**
 * Multiplayer table rules the client shows: range of influence (who a player can affect) and the choice of what to
 * attack when there is more than one defender.
 */

/** Seats between two players around the table, the short way (turn order is seat order). */
export function seatDistance(players: readonly Pick<PlayerView, 'playerId'>[], a: string, b: string): number {
  const i = players.findIndex((player) => player.playerId === a);
  const j = players.findIndex((player) => player.playerId === b);
  if (i < 0 || j < 0) return Infinity;
  const apart = Math.abs(i - j);
  return Math.min(apart, players.length - apart);
}

/**
 * Whether `otherId` is within `myId`'s range of influence. Players who left the game don't count as seats, so the
 * range closes around them (rule 801.6).
 */
export function inRange(view: Pick<GameView, 'players' | 'rangeOfInfluence'> | null | undefined, myId: string | null, otherId: string): boolean {
  const range = view?.rangeOfInfluence ?? 'ALL';
  if (range === 'ALL' || !myId || myId === otherId) return true;
  const seated = (view?.players ?? []).filter((player) => !player.hasLeft || player.playerId === myId || player.playerId === otherId);
  return seatDistance(seated, myId, otherId) <= (range === 'ONE' ? 1 : 2);
}

export interface DefenderOption {
  id: string;
  kind: 'player' | 'planeswalker' | 'battle';
  name: string;
  /** a player's life, or a planeswalker's loyalty / a battle's defense */
  value: string | null;
  /** the controller, for planeswalkers and battles */
  controllerName: string | null;
}

function permanentById(view: GameView, id: string): { permanent: PermanentView; controller: PlayerView } | null {
  for (const player of view.players ?? []) {
    const permanent = player.battlefield?.[id];
    if (permanent) return { permanent, controller: player };
  }
  return null;
}

/**
 * The server's "which player, planeswalker or battle does this creature attack?" question (TargetDefender, asked
 * while declaring attackers when there is more than one defender), as named options; null for any other question.
 */
export function defenderChoice(prompt: Prompt | null | undefined, view: GameView | null | undefined): DefenderOption[] | null {
  if (!prompt || prompt.kind !== 'target' || !view || view.step !== 'DECLARE_ATTACKERS' || prompt.cards) return null;
  // the filter is named "player, planeswalker, or battle to attack"
  if (prompt.targets.length < 2 || !/\bto attack\b/i.test(prompt.text ?? '')) return null;
  const players = new Map((view.players ?? []).map((player) => [player.playerId!, player]));
  const options: DefenderOption[] = [];
  for (const id of prompt.targets) {
    const player = players.get(id);
    if (player) {
      options.push({ id, kind: 'player', name: player.name ?? 'Player', value: String(player.life ?? 0), controllerName: null });
      continue;
    }
    const found = permanentById(view, id);
    const types = found?.permanent.cardTypes ?? [];
    if (!found || !(types.includes('PLANESWALKER') || types.includes('BATTLE'))) return null;
    options.push({
      id,
      kind: types.includes('PLANESWALKER') ? 'planeswalker' : 'battle',
      name: found.permanent.name ?? 'Permanent',
      value: found.permanent.loyalty || found.permanent.defense || null,
      controllerName: found.controller.name ?? null,
    });
  }
  return options;
}
