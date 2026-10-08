import { useCallback, useSyncExternalStore } from 'react';
import { ImageResolver } from './ImageResolver';
import { createIndexedDbImageStore } from './indexedDbStore';
import { printingKey, type CardFace, type CardImageRef, type ImageSize } from './imageLinks';

let sharedResolver: ImageResolver | null = null;

/** The app-wide image resolver (created on first use). */
export function imageResolver(): ImageResolver {
  sharedResolver ??= new ImageResolver({ store: createIndexedDbImageStore() });
  return sharedResolver;
}

/**
 * Image link for a card: a string when known, null while it is being looked up,
 * undefined when there is no picture (draw a text frame).
 */
export function useCardImage(
  card: CardImageRef | null | undefined,
  face: CardFace = 'front',
  size: ImageSize = 'normal',
): string | null | undefined {
  const resolver = imageResolver();
  // subscribe to this card's printing only: other cards resolving must not re-render this one
  const key = card && !card.isToken ? printingKey(card) : null;
  const subscribe = useCallback((listener: () => void) => resolver.subscribeKey(key, listener), [resolver, key]);
  // the snapshot is the link itself (a string, null or undefined), so React skips renders when it is unchanged
  return useSyncExternalStore(subscribe, () => (card ? resolver.resolve(card, face, size) : undefined));
}
