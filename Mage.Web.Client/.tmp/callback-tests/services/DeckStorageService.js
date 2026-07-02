import { DeckSerializer } from "./DeckSerializer.js";
const STORAGE_PREFIX = "mage_deck_";
const META_KEY = "mage_decks_meta";
export class LocalDeckStorage {
    async saveDeck(deck, options = {}) {
        const meta = this.getMeta();
        // Use existing deck ID if available, otherwise generate new one or find by name
        let id;
        if (options.forceNew) {
            id = crypto.randomUUID();
        }
        else if (deck.id) {
            id = deck.id;
        }
        else {
            const existing = meta.find(m => m.name === deck.name);
            id = existing?.id || crypto.randomUUID();
        }
        // Store extended deck data as JSON (preserving metadata)
        const deckData = {
            ...deck,
            id,
            updatedAt: Date.now(),
            createdAt: deck.createdAt || Date.now(),
        };
        localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(deckData));
        const newMetaItem = {
            id,
            name: deck.name || "Untitled Deck",
            description: deck.description,
            format: deck.format,
            updatedAt: Date.now(),
            cardCount: deck.cards.reduce((sum, c) => sum + c.amount, 0),
            sideboardCount: deck.sideboard.reduce((sum, c) => sum + c.amount, 0),
            coverCard: deck.coverCard,
            colors: deck.colors,
        };
        const newMeta = meta.filter(m => m.id !== id);
        newMeta.push(newMetaItem);
        this.saveMeta(newMeta);
        return id;
    }
    async loadDeck(id) {
        const content = localStorage.getItem(STORAGE_PREFIX + id);
        if (!content)
            return null;
        // Try parsing as JSON first (new format), fall back to .dck format
        try {
            const parsed = JSON.parse(content);
            // Check if it looks like a deck object (has cards array)
            if (parsed && Array.isArray(parsed.cards)) {
                return parsed;
            }
        }
        catch {
            // Not JSON, try legacy .dck format
        }
        // Legacy format: parse with DeckSerializer
        const deck = DeckSerializer.importDeck(content);
        const meta = this.getMeta();
        const m = meta.find(x => x.id === id);
        if (m) {
            deck.name = m.name;
            deck.description = m.description;
            deck.coverCard = m.coverCard;
            deck.colors = m.colors;
        }
        deck.id = id;
        return deck;
    }
    async listDecks() {
        const meta = this.getMeta();
        return meta.map(m => ({
            id: m.id,
            name: m.name,
            description: m.description,
            format: m.format,
            updatedAt: m.updatedAt,
            cardCount: m.cardCount,
            sideboardCount: m.sideboardCount,
            coverCard: m.coverCard,
            colors: m.colors,
        })).sort((a, b) => b.updatedAt - a.updatedAt);
    }
    async deleteDeck(id) {
        localStorage.removeItem(STORAGE_PREFIX + id);
        const meta = this.getMeta();
        this.saveMeta(meta.filter(m => m.id !== id));
    }
    getMeta() {
        const s = localStorage.getItem(META_KEY);
        if (!s)
            return [];
        try {
            return JSON.parse(s);
        }
        catch {
            return [];
        }
    }
    saveMeta(meta) {
        localStorage.setItem(META_KEY, JSON.stringify(meta));
    }
}
export const deckStorage = new LocalDeckStorage();
