import type { DeckCardInfo, DeckCardLists } from "./types.js";

/** Adds a second list to a deck: the same printing (or the same name without one) adds up instead of repeating. */
export function appendDeckCardLists(baseDeck: DeckCardLists, deckToAppend: DeckCardLists): DeckCardLists {
  return {
    ...baseDeck,
    cards: mergeCardLists(baseDeck.cards, deckToAppend.cards),
    sideboard: mergeCardLists(baseDeck.sideboard, deckToAppend.sideboard),
    updatedAt: Date.now(),
  };
}

function mergeCardLists(baseCards: DeckCardInfo[], cardsToAppend: DeckCardInfo[]): DeckCardInfo[] {
  const merged = baseCards.map(card => ({ ...card }));
  const indexByIdentity = new Map(merged.map((card, index) => [cardIdentity(card), index]));

  for (const card of cardsToAppend) {
    const identity = cardIdentity(card);
    const existingIndex = indexByIdentity.get(identity);

    if (existingIndex === undefined) {
      indexByIdentity.set(identity, merged.length);
      merged.push({ ...card });
      continue;
    }

    merged[existingIndex] = {
      ...merged[existingIndex],
      amount: merged[existingIndex].amount + card.amount,
    };
  }

  return merged;
}

function cardIdentity(card: DeckCardInfo): string {
  return [
    card.setCode?.trim().toUpperCase() ?? '',
    card.cardNumber?.trim().toLowerCase() ?? '',
    card.cardName.trim().toLowerCase(),
  ].join('|');
}
