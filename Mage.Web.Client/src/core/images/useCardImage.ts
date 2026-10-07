import { useSyncExternalStore } from 'react';
import { ImageResolver } from './ImageResolver';
import { createIndexedDbImageStore } from './indexedDbStore';
import type { CardFace, CardImageRef, ImageSize } from './imageLinks';

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
  useSyncExternalStore(
    (listener) => resolver.subscribe(listener),
    () => resolver.getVersion(),
  );
  return card ? resolver.resolve(card, face, size) : undefined;
}
