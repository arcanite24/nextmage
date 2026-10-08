import { DeckSerializer } from './DeckSerializer';
import type { DeckCardInfo, DeckCardLists } from './types';

/** The ways a deck leaves the client. */
export type DeckExportFormat = 'arena' | 'mtgo' | 'dck';

export interface DeckExportFormatInfo {
  format: DeckExportFormat;
  /** menu label */
  label: string;
  /** file extension when downloaded */
  extension: string;
  mime: string;
}

export const DECK_EXPORT_FORMATS: Record<DeckExportFormat, DeckExportFormatInfo> = {
  arena: { format: 'arena', label: 'Arena', extension: 'txt', mime: 'text/plain' },
  mtgo: { format: 'mtgo', label: 'MTGO', extension: 'txt', mime: 'text/plain' },
  dck: { format: 'dck', label: 'XMage .dck', extension: 'dck', mime: 'text/plain' },
};

function oneLine(value: string | null | undefined): string {
  return (value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

function present(cards: DeckCardInfo[]): DeckCardInfo[] {
  return cards.filter((card) => card.amount > 0 && card.cardName.trim());
}

/** "4 Lightning Bolt (M10) 146": MTG Arena's import format, which most deck sites also read. */
function arenaLine(card: DeckCardInfo): string {
  const printing = card.setCode && card.cardNumber ? ` (${card.setCode.toUpperCase()}) ${card.cardNumber}` : '';
  return `${card.amount} ${oneLine(card.cardName)}${printing}`;
}

/** Arena: "Deck" and "Sideboard" sections, printings kept. */
export function exportArena(deck: DeckCardLists): string {
  const lines = ['Deck', ...present(deck.cards).map(arenaLine)];
  const side = present(deck.sideboard);
  if (side.length > 0) lines.push('', 'Sideboard', ...side.map(arenaLine));
  return `${lines.join('\n')}\n`;
}

/** MTGO .txt: plain names, the sideboard after a blank line. Copies of a card in several printings are merged. */
export function exportMtgo(deck: DeckCardLists): string {
  const merge = (cards: DeckCardInfo[]) => {
    const counts = new Map<string, number>();
    for (const card of present(cards)) {
      const name = oneLine(card.cardName);
      counts.set(name, (counts.get(name) ?? 0) + card.amount);
    }
    return [...counts].map(([name, amount]) => `${amount} ${name}`);
  };
  const lines = merge(deck.cards);
  const side = merge(deck.sideboard);
  if (side.length > 0) lines.push('', ...side);
  return `${lines.join('\n')}\n`;
}

/** XMage .dck: "4 [M10:146] Lightning Bolt", "SB: ..." for the sideboard, and the deck's name on a NAME: line. */
export function exportDck(deck: DeckCardLists): string {
  const name = oneLine(deck.name);
  const body = DeckSerializer.exportDeck({ ...deck, cards: present(deck.cards), sideboard: present(deck.sideboard) });
  return name ? `NAME:${name}\n${body}` : body;
}

export function exportDeckAs(deck: DeckCardLists, format: DeckExportFormat): string {
  switch (format) {
    case 'arena': return exportArena(deck);
    case 'mtgo': return exportMtgo(deck);
    case 'dck': return exportDck(deck);
  }
}

/** A safe file name for the deck: "Burn deck.dck". */
export function deckFileName(deck: DeckCardLists, format: DeckExportFormat): string {
  const base = oneLine(deck.name)
    // characters Windows, macOS or Linux refuse in file names
    .replace(/[<>:"/\\|?*]/g, ' ')
    .split('')
    .filter((char) => char.charCodeAt(0) >= 32)
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 80);
  return `${base || 'deck'}.${DECK_EXPORT_FORMATS[format].extension}`;
}

/** A name for a copy that doesn't clash with the names already taken: "Burn (copy)", "Burn (copy 2)". */
export function copyName(name: string | null | undefined, taken: Iterable<string>): string {
  const base = (oneLine(name) || 'Untitled deck').replace(/\s+\(copy(?: \d+)?\)$/, '');
  const used = new Set(taken);
  let candidate = `${base} (copy)`;
  for (let index = 2; used.has(candidate); index++) candidate = `${base} (copy ${index})`;
  return candidate;
}
