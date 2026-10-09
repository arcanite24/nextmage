import type { CardView, GameView, PlayerView } from '../../protocol/generated/views';

/**
 * Commander bookkeeping read from the game view. The server keeps it as info lines on the commander card's rules text
 * (CommanderInfoWatcher): "<b>Commander</b> 2 times played from the command zone." and
 * "<b>Commander</b> did 7 combat damage to player Ana.", on the card wherever it is.
 */

export interface CommanderDamage {
  /** the damaged player's name, as the server writes it */
  playerName: string;
  amount: number;
}

export interface CommanderFacts {
  /** times cast from the command zone */
  casts: number;
  /** the extra generic mana the next cast from the command zone costs (two per earlier cast) */
  tax: number;
  damage: CommanderDamage[];
}

/** Combat damage from one commander that makes a player lose (rule 903.10a). */
export const COMMANDER_DAMAGE_LETHAL = 21;

const TAG = /<[^>]*>/g;
// Oathbreaker games name the line after the kind of commander
const KIND = String.raw`(?:Commander|Oathbreaker|Signature Spell)`;
const LINE = new RegExp(`^${KIND}\\b`, 'i');
const CASTS = new RegExp(String.raw`^${KIND}\s+(\d+)\s+times?\s+played from the command zone`, 'i');
const DAMAGE = new RegExp(String.raw`^${KIND}\s+did\s+(\d+)\s+combat damage to player\s+(.+?)\.?$`, 'i');

function plain(line: string): string {
  return line.replace(TAG, '').replace(/\s+/g, ' ').trim();
}

/** The commander lines of a card's rules text, or null for a card that isn't anyone's commander. */
export function commanderFacts(card: Pick<CardView, 'rules'> | null | undefined): CommanderFacts | null {
  let commander = false;
  let casts = 0;
  const damage: CommanderDamage[] = [];
  for (const line of card?.rules ?? []) {
    const text = plain(line);
    if (!LINE.test(text)) continue;
    commander = true;
    const cast = CASTS.exec(text);
    if (cast) casts = Number(cast[1]);
    const hit = DAMAGE.exec(text);
    if (hit) damage.push({ playerName: hit[2].trim(), amount: Number(hit[1]) });
  }
  return commander ? { casts, tax: casts * 2, damage } : null;
}

export type CommanderZone = 'command' | 'battlefield' | 'graveyard' | 'exile';

export interface CommanderStatus extends CommanderFacts {
  /** the card's object id where it is now (clickable when it can be cast from the command zone) */
  id: string;
  name: string;
  ownerId: string;
  zone: CommanderZone;
  card: CardView;
}

/** Every player's commanders, wherever they are on the visible board, by owner. */
export function commandersByPlayer(view: GameView | null | undefined): Map<string, CommanderStatus[]> {
  const result = new Map<string, CommanderStatus[]>();
  // a commander can be on anyone's side of the table (stolen), but it is still its owner's
  const battlefield = (view?.players ?? []).flatMap((player) => Object.values(player.battlefield ?? {}));
  for (const player of view?.players ?? []) {
    const ownerId = player.playerId!;
    const found: CommanderStatus[] = [];
    const seen = new Set<string>();
    const add = (card: CardView | undefined, zone: CommanderZone) => {
      if (!card) return;
      const facts = commanderFacts(card);
      // the command zone lists commanders as such even before their info lines arrive
      const isCommander = facts !== null || (zone === 'command' && card.mageObjectType === 'COMMANDER');
      const key = card.name ?? card.id ?? '';
      if (!isCommander || seen.has(key)) return;
      seen.add(key);
      found.push({ ...(facts ?? { casts: 0, tax: 0, damage: [] }), id: card.id!, name: card.name ?? 'Commander', ownerId, zone, card });
    };
    for (const card of (player.commandList ?? []) as CardView[]) add(card, 'command');
    for (const permanent of battlefield) {
      if ((permanent.ownerId ?? permanent.controllerId) === ownerId) add(permanent, 'battlefield');
    }
    for (const card of Object.values(player.graveyard ?? {})) add(card, 'graveyard');
    for (const card of Object.values(player.exile ?? {})) add(card, 'exile');
    if (found.length > 0) result.set(ownerId, found);
  }
  return result;
}

/** Commander damage a player has taken, by commander, most first (only commanders that hit them). */
export function commanderDamageTo(player: PlayerView, commanders: Map<string, CommanderStatus[]>): { commander: CommanderStatus; amount: number }[] {
  const name = plain(player.name ?? '');
  const hits: { commander: CommanderStatus; amount: number }[] = [];
  for (const list of commanders.values()) {
    for (const commander of list) {
      const hit = commander.damage.find((entry) => entry.playerName === name);
      if (hit && hit.amount > 0) hits.push({ commander, amount: hit.amount });
    }
  }
  return hits.sort((a, b) => b.amount - a.amount);
}
