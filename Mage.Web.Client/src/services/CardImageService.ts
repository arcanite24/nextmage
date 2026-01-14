/**
 * Card Image Service
 * 
 * Handles loading and caching of card images from Scryfall CDN.
 */

import { CardView, SimpleCardView } from '../types';



type ImageSize = 'small' | 'normal' | 'large' | 'png' | 'art_crop' | 'border_crop';

interface ImageCache {
    url: string;
    loaded: boolean;
    error: boolean;
}

class CardImageService {
    private cache = new Map<string, ImageCache>();
    private loadingPromises = new Map<string, Promise<string>>();

    /**
     * Get the Scryfall image URL for a card
     */
    /**
     * Get the Scryfall image URL for a card
     * 
     * Since we only have setCode and cardNumber (not Scryfall UUID), we must use the 
     * Scryfall API to redirect us to the correct image.
     */
    getImageUrl(
        card: CardView | SimpleCardView,
        size: ImageSize = 'normal',
        face: 'front' | 'back' = 'front'
    ): string {
        const setCode = card.expansionSetCode.toLowerCase();
        const number = card.cardNumber;

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
        return `https://api.scryfall.com/cards/${setCode.toLowerCase()}/${cardNumber}?format=image&version=${size}`;
    }

    /**
     * Preload an image and return a promise that resolves when loaded
     */
    preload(card: CardView | SimpleCardView, size: ImageSize = 'normal'): Promise<string> {
        const cacheKey = `${card.expansionSetCode}-${card.cardNumber}-${size}`;

        // Return cached result if available
        const cached = this.cache.get(cacheKey);
        if (cached) {
            return cached.error ? Promise.reject(new Error('Image failed to load')) : Promise.resolve(cached.url);
        }

        // Return existing loading promise if one exists
        const existingPromise = this.loadingPromises.get(cacheKey);
        if (existingPromise) {
            return existingPromise;
        }

        // Create new loading promise
        const url = this.getImageUrl(card, size);
        const promise = new Promise<string>((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                this.cache.set(cacheKey, { url, loaded: true, error: false });
                this.loadingPromises.delete(cacheKey);
                resolve(url);
            };

            img.onerror = () => {
                this.cache.set(cacheKey, { url, loaded: false, error: true });
                this.loadingPromises.delete(cacheKey);
                reject(new Error(`Failed to load image for ${card.expansionSetCode}/${card.cardNumber}`));
            };

            img.src = url;
        });

        this.loadingPromises.set(cacheKey, promise);
        return promise;
    }

    /**
     * Preload multiple cards
     */
    preloadMany(cards: (CardView | SimpleCardView)[], size: ImageSize = 'normal'): Promise<string[]> {
        return Promise.all(
            cards.map(card => this.preload(card, size).catch(() => ''))
        );
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
     * Clear the image cache
     */
    clearCache(): void {
        this.cache.clear();
        this.loadingPromises.clear();
    }
}

export const cardImageService = new CardImageService();
export { CardImageService };
