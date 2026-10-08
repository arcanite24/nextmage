import type { DeckCardInfo, DeckCardLists, SearchCardView } from '../types/index.js';

export type DeckCardZone = 'main' | 'side';

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function zoneKey(zone: DeckCardZone): 'cards' | 'sideboard' {
  return zone === 'main' ? 'cards' : 'sideboard';
}

function normalizedAmount(amount: number): number {
  return Math.max(0, Math.floor(Number.isFinite(amount) ? amount : 0));
}

function cardIdentity(card: DeckCardInfo): string {
  return [
    normalizeText(card.setCode),
    normalizeText(card.cardNumber),
    normalizeText(card.cardName),
  ].join('|');
}

function sameDeckCard(left: DeckCardInfo, right: DeckCardInfo): boolean {
  const leftSet = normalizeText(left.setCode);
  const rightSet = normalizeText(right.setCode);
  const leftNumber = normalizeText(left.cardNumber);
  const rightNumber = normalizeText(right.cardNumber);

  if (leftSet && rightSet && leftNumber && rightNumber) {
    return leftSet === rightSet && leftNumber === rightNumber;
  }

  return cardIdentity(left) === cardIdentity(right)
    || normalizeText(left.cardName) === normalizeText(right.cardName);
}

function cloneCardList(cards: DeckCardInfo[]): DeckCardInfo[] {
  return cards.map(card => ({ ...card }));
}

function updateDeckZone(deck: DeckCardLists, zone: DeckCardZone, cards: DeckCardInfo[]): DeckCardLists {
  return {
    ...deck,
    [zoneKey(zone)]: cards,
    updatedAt: Date.now(),
  };
}

function toDeckCard(card: SearchCardView): DeckCardInfo {
  return {
    cardName: card.name,
    setCode: card.expansionSetCode,
    cardNumber: card.cardNumber,
    amount: 1,
  };
}

export function addDeckCardCopies(
  deck: DeckCardLists,
  card: DeckCardInfo,
  zone: DeckCardZone,
  amount = 1,
): DeckCardLists {
  const copiesToAdd = normalizedAmount(amount);
  if (copiesToAdd === 0) return deck;

  const targetList = cloneCardList(deck[zoneKey(zone)]);
  const existing = targetList.find(candidate => sameDeckCard(candidate, card));
  if (existing) {
    existing.amount += copiesToAdd;
  } else {
    targetList.push({ ...card, amount: copiesToAdd });
  }

  return updateDeckZone(deck, zone, targetList);
}

export function addSearchCardToDeck(
  deck: DeckCardLists,
  card: SearchCardView,
  zone: DeckCardZone,
  amount = 1,
): DeckCardLists {
  return addDeckCardCopies(deck, toDeckCard(card), zone, amount);
}

export function setDeckCardAmount(
  deck: DeckCardLists,
  card: DeckCardInfo,
  zone: DeckCardZone,
  amount: number,
): DeckCardLists {
  const nextAmount = normalizedAmount(amount);
  const targetList = cloneCardList(deck[zoneKey(zone)]);
  const existingIndex = targetList.findIndex(candidate => sameDeckCard(candidate, card));

  if (existingIndex === -1) {
    if (nextAmount === 0) return deck;
    targetList.push({ ...card, amount: nextAmount });
  } else if (nextAmount === 0) {
    targetList.splice(existingIndex, 1);
  } else {
    targetList[existingIndex] = { ...targetList[existingIndex], amount: nextAmount };
  }

  return updateDeckZone(deck, zone, targetList);
}

export function decrementDeckCard(
  deck: DeckCardLists,
  card: DeckCardInfo,
  zone: DeckCardZone,
  amount = 1,
): DeckCardLists {
  const copiesToRemove = normalizedAmount(amount);
  if (copiesToRemove === 0) return deck;

  const targetList = cloneCardList(deck[zoneKey(zone)]);
  const existing = targetList.find(candidate => sameDeckCard(candidate, card));
  if (!existing) return deck;

  return setDeckCardAmount(deck, existing, zone, existing.amount - copiesToRemove);
}

export function moveDeckCard(
  deck: DeckCardLists,
  card: DeckCardInfo,
  fromZone: DeckCardZone,
  toZone: DeckCardZone,
  amount = 1,
): DeckCardLists {
  if (fromZone === toZone) return deck;

  const sourceList = deck[zoneKey(fromZone)];
  const sourceCard = sourceList.find(candidate => sameDeckCard(candidate, card));
  if (!sourceCard) return deck;

  const copiesToMove = Math.min(sourceCard.amount, normalizedAmount(amount));
  if (copiesToMove === 0) return deck;

  const afterRemove = decrementDeckCard(deck, sourceCard, fromZone, copiesToMove);
  return addDeckCardCopies(afterRemove, sourceCard, toZone, copiesToMove);
}
