import type { ManaPoolView, ManaType, PlayerView } from '../../protocol/generated/views';
import type { PlayManaPrompt } from './prompt';
import { stripMarkup } from './prompt';

/**
 * Paying a cost: what is still owed (from the server's "Pay {2}{G}" prompt, which names the spell or ability being
 * paid for) and the floating mana that can pay it, clicked on the player's mana pool.
 */

export const POOL_MANA: { key: keyof ManaPoolView; manaType: ManaType; symbol: string }[] = [
  { key: 'white', manaType: 'WHITE', symbol: 'w' },
  { key: 'blue', manaType: 'BLUE', symbol: 'u' },
  { key: 'black', manaType: 'BLACK', symbol: 'b' },
  { key: 'red', manaType: 'RED', symbol: 'r' },
  { key: 'green', manaType: 'GREEN', symbol: 'g' },
  { key: 'colorless', manaType: 'COLORLESS', symbol: 'c' },
];

/** Board id for a kind of floating mana: the pool's symbols are clicked like any other object. */
export function poolId(manaType: ManaType): string {
  return `pool:${manaType}`;
}

/** Kinds of mana floating in a player's pool. */
export function poolTypes(player: Pick<PlayerView, 'manaPool'> | null | undefined): ManaType[] {
  return POOL_MANA.filter(({ key }) => (player?.manaPool?.[key] ?? 0) > 0).map(({ manaType }) => manaType);
}

export interface Payment {
  /** the unpaid part of the cost, as mana symbols ("{2}{G}"); empty when the prompt doesn't show one */
  cost: string;
  /** what is being paid for */
  sourceId: string | null;
  sourceName: string;
}

/** Reads a payment prompt: "Pay {2}{G}<div ...><font object_id='...'>Llanowar Elves</font> [1a2]</div>". */
export function parsePayment(prompt: Pick<PlayManaPrompt, 'message'>): Payment {
  const message = prompt.message;
  const split = message.search(/<div/i);
  const head = split >= 0 ? message.slice(0, split) : message;
  const tail = split >= 0 ? message.slice(split) : '';
  const cost = (stripMarkup(head).match(/\{[^}]+\}/g) ?? []).join('');
  return {
    cost,
    sourceId: /object_id='([^']+)'/.exec(tail)?.[1] ?? null,
    sourceName: stripMarkup(tail).replace(/\s*\[[0-9a-f]{3}\]/gi, '').trim(),
  };
}
