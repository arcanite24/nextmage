import { DeckSerializer } from '../core/decks/DeckSerializer.js';
import { cardResolverService, type CardUnresolvedReportItem, type DeckResolutionResult, type ResolvedCard } from './CardResolverService.js';
import type { DeckCardInfo } from '../types/index.js';

export interface DeckImportReplacement {
  item: CardUnresolvedReportItem;
  replacement: ResolvedCard;
}

export const DECK_TEXT_IMPORT_EXTENSION_PATTERN = /\.(dck|txt|dec|mwdeck|dek|mtga|draft|cod|o8d|json)$/i;
export const DECK_TEXT_IMPORT_ACCEPT = '.dck,.txt,.dec,.mwdeck,.dek,.mtga,.draft,.cod,.o8d,.json';

export function candidateValue(candidate: ResolvedCard): string {
  return JSON.stringify(candidate);
}

export function formatCandidate(candidate: ResolvedCard): string {
  return `${candidate.name} [${candidate.setCode}:${candidate.cardNumber}]`;
}

export function reportItemToDeckCard(item: CardUnresolvedReportItem): DeckCardInfo {
  return {
    amount: item.amount,
    cardName: item.cardName,
    setCode: item.setCode,
    cardNumber: item.cardNumber,
  };
}

export function describeImportZones(item: CardUnresolvedReportItem): string {
  return item.zones
    .map(zone => `${zone.zone === 'main' ? 'Main' : 'Sideboard'} ${zone.amount}`)
    .join(', ');
}

export function parseAlternateSearch(item: CardUnresolvedReportItem, query: string): DeckCardInfo {
  const trimmed = query.trim();
  if (!trimmed) {
    return reportItemToDeckCard(item);
  }

  const xmage = trimmed.match(/^\[([^:\]]+):([^\]]+)]\s*(.+)?$/);
  if (xmage) {
    return {
      amount: item.amount,
      cardName: (xmage[3] || item.cardName).trim(),
      setCode: xmage[1],
      cardNumber: xmage[2],
    };
  }

  const mtga = trimmed.match(/^(.+?)\s+\(([a-zA-Z0-9]+)\)\s+([a-zA-Z0-9-]+)$/);
  if (mtga) {
    return {
      amount: item.amount,
      cardName: mtga[1].trim(),
      setCode: mtga[2],
      cardNumber: mtga[3],
    };
  }

  const setAndNumber = trimmed.match(/^([a-zA-Z0-9]{2,8})[:#\s]+([a-zA-Z0-9-]+)$/);
  if (setAndNumber && /\d/.test(setAndNumber[2])) {
    return {
      amount: item.amount,
      cardName: item.cardName,
      setCode: setAndNumber[1],
      cardNumber: setAndNumber[2],
    };
  }

  return {
    amount: item.amount,
    cardName: trimmed,
    setCode: item.setCode,
    cardNumber: item.cardNumber,
  };
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(String(event.target?.result || ''));
    reader.onerror = () => reject(new Error(`Could not read ${file.name || 'deck file'}.`));
    reader.readAsText(file);
  });
}

export function getDeckNameFromFile(file: File): string {
  return file.name.replace(DECK_TEXT_IMPORT_EXTENSION_PATTERN, '') || 'Imported Deck';
}

export async function resolveImportedDeckText(content: string, deckName: string): Promise<DeckResolutionResult> {
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    throw new Error('No deck text was found to import.');
  }

  const deck = DeckSerializer.importDeck(trimmedContent);
  deck.name = deckName;
  return cardResolverService.resolveDeckWithReport(deck);
}

// moved to core/decks so the new app does not depend on this legacy service
export { appendDeckCardLists } from '../core/decks/merge.js';
