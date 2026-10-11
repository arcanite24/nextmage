import { imageResolver } from '../../core/images/useCardImage';
import type { CardImageRef, ImageSize } from '../../core/images/imageLinks';
import { DEVICE_PICTURES, storePictures } from '../nativePictures';

/**
 * Card pictures already downloaded and decoded in this session. A card face whose picture is here shows it on its
 * first frame instead of flashing the text frame while the browser reports the load again.
 */
const decoded = new Set<string>();
const pending = new Map<string, Promise<void>>();
/** keep decoded bitmaps referenced so the browser keeps them warm */
const held: HTMLImageElement[] = [];
const MAX_HELD = 600;

export function isDecoded(src: string): boolean {
  return decoded.has(src);
}

export function markDecoded(src: string) {
  decoded.add(src);
}

/** Download and decode a picture ahead of time. */
export function warmImage(src: string): Promise<void> {
  if (decoded.has(src)) return Promise.resolve();
  const existing = pending.get(src);
  if (existing) return existing;
  const image = new Image();
  image.decoding = 'async';
  image.src = src;
  const done = image.decode()
    .then(() => {
      decoded.add(src);
      held.push(image);
      if (held.length > MAX_HELD) held.shift();
    })
    .catch(() => undefined)
    .finally(() => pending.delete(src));
  pending.set(src, done);
  return done;
}

/** Every size the app shows a card at: the device's picture store keeps them all (board, zoom, deck boxes). */
const STORED_SIZES: ImageSize[] = ['small', 'normal', 'large', 'art_crop'];

/**
 * Warm every picture of these cards at the sizes the match shows (board and zoom). Links that are still being looked
 * up are warmed as soon as the resolver learns them. In the Android app every size is also stored on the device.
 */
export function warmCards(cards: Iterable<CardImageRef>, sizes: ImageSize[] = ['normal', 'large']) {
  watchLinks(cards, sizes, (src) => void warmImage(src));
}

/**
 * Keep these cards' pictures on the device (the Android app) without decoding them now: a deck the player is
 * looking at, likely to be played next. Nothing happens on the web.
 */
export function storeCards(cards: Iterable<CardImageRef>) {
  if (DEVICE_PICTURES) watchLinks(cards, [], () => undefined);
}

/** Calls `onLink` with each card's link at each size as the resolver learns them; device storage rides along. */
function watchLinks(cards: Iterable<CardImageRef>, sizes: ImageSize[], onLink: (src: string) => void) {
  const resolver = imageResolver();
  const list = [...cards];
  resolver.prefetch(list);
  const remaining = new Set(list);
  const wanted = DEVICE_PICTURES ? [...new Set([...sizes, ...STORED_SIZES])] : sizes;
  const tryWarm = () => {
    const store: string[] = [];
    for (const card of remaining) {
      let resolved = true;
      for (const size of wanted) {
        const src = resolver.resolve(card, 'front', size);
        if (typeof src === 'string') {
          if (sizes.includes(size)) onLink(src);
          if (DEVICE_PICTURES) store.push(src);
        } else if (src === null) resolved = false;
      }
      if (resolved) remaining.delete(card);
    }
    storePictures(store);
    return remaining.size === 0;
  };
  if (tryWarm()) return;
  const unsubscribe = resolver.subscribe(() => {
    if (tryWarm()) unsubscribe();
  });
  // links that never resolve stop being watched after a while
  setTimeout(unsubscribe, 60_000);
}
