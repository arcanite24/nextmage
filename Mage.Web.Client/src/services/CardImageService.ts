/**
 * Card Image Service
 * 
 * Handles loading and caching of card images from Scryfall CDN.
 * Uses IndexedDB for persistent caching to save bandwidth.
 */

import { CardView, GameView } from '../types';
import { imageCacheManager } from './ImageCacheManager';

type ImageSize = 'small' | 'normal' | 'large' | 'png' | 'art_crop' | 'border_crop';
export type CardImageFallbackMode = 'card-back' | 'text-card';

interface ImageCache {
  url: string;
  loaded: boolean;
  error: boolean;
}

interface ImageCard {
  id?: string;
  expansionSetCode: string;
  cardNumber: string;
  transformed?: boolean;
  isDoubleFacedCard?: boolean;
  name?: string;
  displayName?: string;
  displayFullName?: string;
  cardTypes?: string[];
  manaCostLeftStr?: string[];
  manaCostRightStr?: string[];
}

// Set of known error cache keys to avoid repeated network requests
const errorCache = new Set<string>();

class CardImageService {
  private cache = new Map<string, ImageCache>();
  private loadingPromises = new Map<string, Promise<string>>();

  /**
   * Get Scryfall image URL for a card
   * 
   * Since we only have setCode and cardNumber (not Scryfall UUID), we must use
   * Scryfall API to redirect us to the correct image.
   */
  getImageUrl(
    card: ImageCard,
    size: ImageSize = 'normal',
    face: 'front' | 'back' = 'front'
  ): string {
    const setCode = card.expansionSetCode.toLowerCase();

    // Sanitize card number: remove '*' suffix often used in XMage for variations
    // which causes Scryfall 404s if sent literally or encoded
    let number = card.cardNumber;
    if (number.endsWith('*')) {
      number = number.slice(0, -1);
    }
    number = encodeURIComponent(number);

    const shouldUseBackFace = face === 'back' || ('transformed' in card && card.transformed && 'isDoubleFacedCard' in card && card.isDoubleFacedCard);
    return `https://api.scryfall.com/cards/${setCode}/${number}?format=image&version=${size}${shouldUseBackFace ? '&face=back' : ''}`;
  }

  /**
   * Get a simple Scryfall API URL
   */
  getApiImageUrl(
    setCode: string,
    cardNumber: string,
    size: ImageSize = 'normal'
  ): string {
    return `https://api.scryfall.com/cards/${setCode.toLowerCase()}/${encodeURIComponent(cardNumber)}?format=image&version=${size}`;
  }

  /**
   * Preload an image and return a promise that resolves when loaded
   * 
   * Uses persistent IndexedDB cache first, then falls back to network.
   * Returns placeholder URL for cards that fail to load (silently).
   */
  async preload(
    card: ImageCard,
    size: ImageSize = 'normal'
  ): Promise<string> {
    const cacheKey = `${card.expansionSetCode}-${card.cardNumber}-${size}`;

    // Check if we've already seen this error - return placeholder immediately
    if (errorCache.has(cacheKey)) {
      return Promise.resolve(this.getPlaceholderUrl());
    }

    const networkUrl = this.getImageUrl(card, size);

    // Check in-memory cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached.error ? Promise.resolve(this.getPlaceholderUrl()) : Promise.resolve(cached.url);
    }

    // Check existing loading promise
    const existingPromise = this.loadingPromises.get(cacheKey);
    if (existingPromise) {
      return existingPromise;
    }

    // Check persistent cache (IndexedDB)
    try {
      const cachedBlob = await imageCacheManager.get(cacheKey);
      if (cachedBlob) {
        // Create object URL from cached blob
        const objectUrl = URL.createObjectURL(cachedBlob);

        // Cache the object URL in memory
        this.cache.set(cacheKey, { url: objectUrl, loaded: true, error: false });

        return Promise.resolve(objectUrl);
      }
    } catch {
      // Silently continue to load from network
    }

    // Load from network
    const promise = new Promise<string>((resolve) => {
      fetch(networkUrl)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          return response.blob();
        })
        .then(async (blob) => {
          // Cache the blob in IndexedDB
          try {
            await imageCacheManager.put(cacheKey, networkUrl, blob);
          } catch {
            // Silently continue, we have the blob
          }

          // Create object URL from blob
          const objectUrl = URL.createObjectURL(blob);

          // Cache the object URL in memory
          this.cache.set(cacheKey, { url: objectUrl, loaded: true, error: false });
          this.loadingPromises.delete(cacheKey);

          resolve(objectUrl);
        })
        .catch(() => {
          // Add to error cache to prevent retrying
          errorCache.add(cacheKey);

          // Cache the error in memory
          this.cache.set(cacheKey, { url: this.getPlaceholderUrl(), loaded: false, error: true });
          this.loadingPromises.delete(cacheKey);

          // Resolve with placeholder instead of rejecting
          resolve(this.getPlaceholderUrl());
        });
    });

    this.loadingPromises.set(cacheKey, promise);
    return promise;
  }


  /**
   * Preload multiple cards in parallel
   */
  preloadMany(
    cards: ImageCard[],
    size: ImageSize = 'normal'
  ): Promise<string[]> {
    return Promise.all(
      cards.map(card => this.preload(card, size).catch(() => ''))
    );
  }

  preloadGameViewImages(gameView: GameView, size: ImageSize = 'normal'): Promise<string[]> {
    const seen = new Set<string>();
    const cards: CardView[] = [];
    const addCards = (source?: Record<string, CardView>) => {
      if (!source) return;
      Object.values(source).forEach((card) => {
        const key = `${card.expansionSetCode}-${card.cardNumber}-${card.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          cards.push(card);
        }
      });
    };

    addCards(gameView.myHand);
    addCards(gameView.stack);
    gameView.players?.forEach((player) => {
      addCards(player.battlefield);
      addCards(player.graveyard);
      addCards(player.exile);
      addCards(player.sideboard);
    });
    gameView.exiles?.forEach((exile) => addCards(exile.cards));
    gameView.revealed?.forEach((revealed) => addCards(revealed.cards));
    gameView.lookedAt?.forEach((lookedAt) => addCards(lookedAt.cards));

    return this.preloadMany(cards, size);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    return await imageCacheManager.getStats();
  }

  /**
   * Get a placeholder image URL for cards that fail to load
   */
  getPlaceholderUrl(): string {
    return '/back.webp';
  }

  getFallbackImageUrl(card?: Partial<ImageCard>, mode: CardImageFallbackMode = 'card-back'): string {
    if (mode !== 'text-card' || !card) {
      return this.getPlaceholderUrl();
    }

    const name = escapeSvgText(card.name || card.displayName || card.displayFullName || 'Unknown card');
    const typeLine = escapeSvgText(card.cardTypes?.join(' ') || 'Card image unavailable');
    const setLine = escapeSvgText([card.expansionSetCode, card.cardNumber].filter(Boolean).join(' #') || 'Image fallback');
    const manaCost = escapeSvgText((card.manaCostRightStr?.length ? card.manaCostRightStr : card.manaCostLeftStr)?.join(' ') || '');
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="336" height="470" viewBox="0 0 336 470">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#1f2937"/>
            <stop offset="0.55" stop-color="#0f172a"/>
            <stop offset="1" stop-color="#312e81"/>
          </linearGradient>
        </defs>
        <rect width="336" height="470" rx="22" fill="#020617"/>
        <rect x="12" y="12" width="312" height="446" rx="18" fill="url(#bg)" stroke="#94a3b8" stroke-opacity="0.55" stroke-width="2"/>
        <rect x="28" y="32" width="280" height="54" rx="10" fill="rgba(15,23,42,0.82)" stroke="#cbd5e1" stroke-opacity="0.32"/>
        <text x="42" y="66" fill="#f8fafc" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="21" font-weight="800">${name}</text>
        <text x="294" y="66" fill="#fde68a" text-anchor="end" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="15" font-weight="700">${manaCost}</text>
        <rect x="28" y="104" width="280" height="214" rx="12" fill="rgba(2,6,23,0.55)" stroke="#64748b" stroke-opacity="0.36"/>
        <text x="168" y="206" fill="#cbd5e1" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="18" font-weight="900">IMAGE FALLBACK</text>
        <text x="168" y="234" fill="#94a3b8" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="13">Card art could not be loaded</text>
        <rect x="28" y="340" width="280" height="42" rx="9" fill="rgba(15,23,42,0.82)" stroke="#cbd5e1" stroke-opacity="0.24"/>
        <text x="42" y="366" fill="#e2e8f0" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="14" font-weight="700">${typeLine}</text>
        <text x="42" y="424" fill="#94a3b8" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="13" font-weight="700">${setLine}</text>
      </svg>
    `;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
  }

  /**
   * Get card back image URL
   */
  getCardBackUrl(): string {
    return '/back.webp';
  }

  /**
   * Clear in-memory cache (does not clear persistent IndexedDB cache)
   */
  clearInMemoryCache(): void {
    this.cache.clear();
    this.loadingPromises.clear();
  }

  /**
   * Clear all caches (both in-memory and persistent)
   */
  async clearAllCaches(): Promise<void> {
    this.clearInMemoryCache();
    await imageCacheManager.clear();
    console.log('[CardImageService] All caches cleared');
  }

  /**
   * Clear old cache entries (e.g., older than 30 days)
   */
  async clearOldCache(maxAgeDays: number = 30): Promise<number> {
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const deletedCount = await imageCacheManager.deleteOldEntries(maxAgeMs);
    return deletedCount;
  }

  /**
   * Get all cache entries for debugging/management
   */
  async getCacheEntries() {
    return await imageCacheManager.getAllEntries();
  }
}

export const cardImageService = new CardImageService();
export { CardImageService };

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .slice(0, 42);
}
