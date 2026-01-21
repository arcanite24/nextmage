/**
 * Card Resolver Service
 * 
 * Resolves deck cards that only have names (e.g., from MTGO format imports)
 * to include setCode and cardNumber by looking them up from the server.
 *
 * Uses in-memory caching to avoid repeated lookups for the same card name.
 */

import { DeckCardInfo, DeckCardLists, SearchCardView, CardSearchCriteria } from '../types';
import { wsService } from './WebSocketService';

interface ResolvedCard {
    name: string;
    setCode: string;
    cardNumber: string;
}

class CardResolverService {
    private cache = new Map<string, ResolvedCard | null>();
    private pendingLookups = new Map<string, Promise<ResolvedCard | null>>();

    /**
     * Normalize a card name for consistent lookup
     */
    private normalizeCardName(name: string): string {
        return name
            .toLowerCase()
            .trim()
            // Handle double-faced / split card names - keep only the front face
            .split(' // ')[0]
            .trim();
    }

    /**
     * Resolve a single card by name
     * Returns resolved card info or null if not found
     */
    async resolveCardByName(cardName: string): Promise<ResolvedCard | null> {
        const normalizedName = this.normalizeCardName(cardName);
        const originalName = cardName.trim();

        // Check cache first
        if (this.cache.has(normalizedName)) {
            return this.cache.get(normalizedName) || null;
        }

        // Check if we're already looking this up
        const pending = this.pendingLookups.get(normalizedName);
        if (pending) {
            return pending;
        }

        // Perform lookup
        const lookupPromise = this.performLookup(originalName, normalizedName);
        this.pendingLookups.set(normalizedName, lookupPromise);

        try {
            const result = await lookupPromise;
            this.cache.set(normalizedName, result);
            return result;
        } finally {
            this.pendingLookups.delete(normalizedName);
        }
    }

    private async performLookup(originalName: string, normalizedName: string): Promise<ResolvedCard | null> {
        try {
            // Search for the card by name
            const criteria: CardSearchCriteria = {
                nameContains: originalName,
                count: 10,
                sortBy: 'name',
            };

            const results = await wsService.searchCards(criteria);

            if (results.length === 0) {
                console.warn(`[CardResolver] Card not found: "${originalName}"`);
                return null;
            }

            // Find exact match (case-insensitive)
            const exactMatch = results.find(card =>
                this.normalizeCardName(card.name) === normalizedName ||
                this.normalizeCardName(card.displayName) === normalizedName
            );

            if (exactMatch) {
                return {
                    name: exactMatch.name,
                    setCode: exactMatch.expansionSetCode,
                    cardNumber: exactMatch.cardNumber,
                };
            }

            // If no exact match, use first result as fallback
            // This handles cases where the name might be slightly different
            const firstResult = results[0];
            console.log(`[CardResolver] Using approximate match for "${originalName}": "${firstResult.name}"`);
            return {
                name: firstResult.name,
                setCode: firstResult.expansionSetCode,
                cardNumber: firstResult.cardNumber,
            };
        } catch (error) {
            console.error(`[CardResolver] Error resolving card "${originalName}":`, error);
            return null;
        }
    }

    /**
     * Resolve all unresolved cards in a deck
     * Returns the deck with resolved cards
     */
    async resolveDeck(deck: DeckCardLists): Promise<DeckCardLists> {
        const resolvedDeck = { ...deck };

        // Collect all unique card names that need resolution
        const cardsToResolve = new Map<string, DeckCardInfo[]>();

        const collectUnresolved = (cards: DeckCardInfo[], zone: 'main' | 'side') => {
            for (const card of cards) {
                if (!card.setCode || !card.cardNumber) {
                    const key = this.normalizeCardName(card.cardName);
                    if (!cardsToResolve.has(key)) {
                        cardsToResolve.set(key, []);
                    }
                    cardsToResolve.get(key)!.push(card);
                }
            }
        };

        collectUnresolved(deck.cards, 'main');
        collectUnresolved(deck.sideboard, 'side');

        if (cardsToResolve.size === 0) {
            // All cards already have setCode and cardNumber
            return deck;
        }

        console.log(`[CardResolver] Resolving ${cardsToResolve.size} unique card names...`);

        // Resolve all unique cards in parallel
        const resolvePromises = Array.from(cardsToResolve.entries()).map(async ([key, cards]) => {
            const cardName = cards[0].cardName;
            const resolved = await this.resolveCardByName(cardName);
            return { key, cards, resolved };
        });

        const resolvedResults = await Promise.all(resolvePromises);

        // Update cards with resolved info
        const updateCards = (cards: DeckCardInfo[]): DeckCardInfo[] => {
            return cards.map(card => {
                if (card.setCode && card.cardNumber) {
                    return card; // Already resolved
                }

                const key = this.normalizeCardName(card.cardName);
                const result = resolvedResults.find(r => r.key === key);

                if (result?.resolved) {
                    return {
                        ...card,
                        cardName: result.resolved.name, // Use official name
                        setCode: result.resolved.setCode,
                        cardNumber: result.resolved.cardNumber,
                    };
                }

                // Could not resolve, keep as-is
                return card;
            });
        };

        resolvedDeck.cards = updateCards(deck.cards);
        resolvedDeck.sideboard = updateCards(deck.sideboard);

        const unresolvedCount = resolvedResults.filter(r => !r.resolved).length;
        if (unresolvedCount > 0) {
            console.warn(`[CardResolver] ${unresolvedCount} card(s) could not be resolved`);
        } else {
            console.log(`[CardResolver] All cards resolved successfully`);
        }

        return resolvedDeck;
    }

    /**
     * Clear the cache
     */
    clearCache(): void {
        this.cache.clear();
        this.pendingLookups.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; entries: string[] } {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys()),
        };
    }
}

// Export singleton instance
export const cardResolverService = new CardResolverService();
export { CardResolverService };
