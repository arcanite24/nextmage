/**
 * Card Image Service
 * 
 * Handles loading and caching of card images from Scryfall CDN.
 * Uses IndexedDB for persistent caching to save bandwidth.
 */

import { CardView, SearchCardView, SearchSimpleCardView, SimpleCardView } from '../types';
import { imageCacheManager } from './ImageCacheManager';

type ImageSize = 'small' | 'normal' | 'large' | 'png' | 'art_crop' | 'border_crop';

interface ImageCache {
  url: string;
  loaded: boolean;
  error: boolean;
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
    card: CardView | SearchCardView | SearchSimpleCardView | SimpleCardView,
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

    return `https://api.scryfall.com/cards/${setCode}/${number}?format=image&version=${size}${face === 'back' ? '&face=back' : ''}`;
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
    card: CardView | SearchCardView | SearchSimpleCardView | SimpleCardView,
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
    } catch (error) {
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
          } catch (cacheError) {
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
    cards: (CardView | SearchCardView | SearchSimpleCardView | SimpleCardView)[],
    size: ImageSize = 'normal'
  ): Promise<string[]> {
    return Promise.all(
      cards.map(card => this.preload(card, size).catch(() => ''))
    );
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
