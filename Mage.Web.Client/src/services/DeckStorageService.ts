import { DeckCardLists } from "../types";
import { DeckSerializer } from "./DeckSerializer";

export interface DeckSummary {
    id: string;
    name: string;
    description?: string;
    updatedAt: number;
}

export interface IDeckStorage {
    saveDeck(deck: DeckCardLists): Promise<string>; // Returns ID
    loadDeck(id: string): Promise<DeckCardLists | null>;
    listDecks(): Promise<DeckSummary[]>;
    deleteDeck(id: string): Promise<void>;
}

const STORAGE_PREFIX = "mage_deck_";
const META_KEY = "mage_decks_meta";

interface DeckMeta {
    id: string;
    name: string;
    updatedAt: number;
}

export class LocalDeckStorage implements IDeckStorage {
    async saveDeck(deck: DeckCardLists): Promise<string> {
        const meta = this.getMeta();

        // Check if we can identify this deck by name to update it?
        // For simple local storage, if the name matches, we overwrite (or update). 
        // But usually user might want multiple versions.
        // Let's check if the deck object has an ID (we'd need to add it to DeckCardLists).
        // Since we don't have ID in deck object yet, we can't reliably update unless we trust name is unique/key.
        // Let's use name as a key for finding existing deck to overwrite.
        // If user changes name, it's a new deck.
        // This mimics file system name uniqueness.

        let id: string = crypto.randomUUID();
        const existing = meta.find(m => m.name === deck.name);
        if (existing) {
            id = existing.id;
        }

        const deckString = DeckSerializer.exportDeck(deck);
        localStorage.setItem(STORAGE_PREFIX + id, deckString);

        const newMetaItem: DeckMeta = {
            id,
            name: deck.name || "Untitled Deck",
            updatedAt: Date.now()
        };

        const newMeta = meta.filter(m => m.id !== id);
        newMeta.push(newMetaItem);
        this.saveMeta(newMeta);

        return id;
    }

    async loadDeck(id: string): Promise<DeckCardLists | null> {
        const content = localStorage.getItem(STORAGE_PREFIX + id);
        if (!content) return null;

        const deck = DeckSerializer.importDeck(content);
        const meta = this.getMeta();
        const m = meta.find(x => x.id === id);
        if (m) {
            deck.name = m.name;
        }
        return deck;
    }

    async listDecks(): Promise<DeckSummary[]> {
        const meta = this.getMeta();
        return meta.map(m => ({
            id: m.id,
            name: m.name,
            updatedAt: m.updatedAt,
        })).sort((a, b) => b.updatedAt - a.updatedAt);
    }

    async deleteDeck(id: string): Promise<void> {
        localStorage.removeItem(STORAGE_PREFIX + id);
        const meta = this.getMeta();
        this.saveMeta(meta.filter(m => m.id !== id));
    }

    private getMeta(): DeckMeta[] {
        const s = localStorage.getItem(META_KEY);
        if (!s) return [];
        try {
            return JSON.parse(s);
        } catch {
            return [];
        }
    }

    private saveMeta(meta: DeckMeta[]) {
        localStorage.setItem(META_KEY, JSON.stringify(meta));
    }
}

export const deckStorage = new LocalDeckStorage();
