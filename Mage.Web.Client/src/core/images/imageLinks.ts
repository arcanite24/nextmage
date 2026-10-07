/**
 * Card image addressing for Scryfall.
 *
 * Printings are identified by XMage set code + collector number (Scryfall uses the same codes, lower case).
 * Exceptions (special sets, tokens) come from the desktop client's lists, exported to /data/scryfall-links.json.
 */

export type ImageSize = 'small' | 'normal' | 'large' | 'art_crop' | 'png';
export type CardFace = 'front' | 'back';

/** What the image service needs to know about a card (CardView, PermanentView and deck cards all fit). */
export interface CardImageRef {
  name?: string;
  displayName?: string;
  expansionSetCode?: string;
  setCode?: string;
  cardNumber?: string;
  isToken?: boolean;
  imageNumber?: number;
  /** emblems, planes and other command objects are served like tokens */
  imageFileName?: string;
}

export interface ScryfallLinks {
  cards: Record<string, string>;
  tokens: Record<string, string>;
}

export function setCodeOf(card: CardImageRef): string {
  return (card.expansionSetCode || card.setCode || '').trim();
}

/** XMage marks some collector numbers with '*' (various art); Scryfall doesn't. */
export function normalizeCollectorNumber(cardNumber: string | undefined): string {
  return (cardNumber ?? '').trim().replace(/\*+$/, '');
}

export function printingKey(card: CardImageRef): string | null {
  const set = setCodeOf(card).toLowerCase();
  const number = normalizeCollectorNumber(card.cardNumber).toLowerCase();
  if (!set || !number) return null;
  return `${set}/${number}`;
}

/** Turns a Scryfall API link from the exported lists into an image link of the wanted size. */
export function toImageLink(apiLink: string, size: ImageSize): string {
  if (/\.(jpg|jpeg|png)(\?|$)/i.test(apiLink)) return apiLink; // already a direct image
  const url = new URL(apiLink);
  url.searchParams.set('format', 'image');
  url.searchParams.set('version', size);
  return url.toString();
}

/** Link from the exported exception lists, if this card or token has one. */
export function exceptionLink(card: CardImageRef, face: CardFace, links: ScryfallLinks | null): string | null {
  if (!links) return null;
  const set = setCodeOf(card).toUpperCase();
  const name = card.name ?? card.displayName ?? '';
  if (!set || !name) return null;

  if (card.isToken) {
    const imageNumber = card.imageNumber ?? 0;
    return links.tokens[imageNumber ? `${set}/${name}/${imageNumber}` : `${set}/${name}`]
      ?? links.tokens[`${set}/${name}`]
      ?? null;
  }

  const number = (card.cardNumber ?? '').trim();
  const faceSuffix = face === 'back' ? 'b' : '';
  return links.cards[`${set}/${name}/${number}${faceSuffix}`]
    ?? links.cards[`${set}/${name}/${number}`]
    ?? links.cards[`${set}/${name}`]
    ?? null;
}

/** Direct API image link for a printing; Scryfall redirects to its CDN. */
export function printingImageLink(card: CardImageRef, face: CardFace, size: ImageSize): string | null {
  const set = setCodeOf(card).toLowerCase();
  const number = normalizeCollectorNumber(card.cardNumber);
  if (!set || !number) return null;
  const url = new URL(`https://api.scryfall.com/cards/${encodeURIComponent(set)}/${encodeURIComponent(number)}`);
  url.searchParams.set('format', 'image');
  url.searchParams.set('version', size);
  if (face === 'back') url.searchParams.set('face', 'back');
  return url.toString();
}

/** Last resort: look the card up by name. */
export function namedImageLink(card: CardImageRef, face: CardFace, size: ImageSize): string | null {
  const name = card.name ?? card.displayName;
  if (!name) return null;
  const url = new URL('https://api.scryfall.com/cards/named');
  url.searchParams.set('exact', name);
  url.searchParams.set('format', 'image');
  url.searchParams.set('version', size);
  if (face === 'back') url.searchParams.set('face', 'back');
  return url.toString();
}
