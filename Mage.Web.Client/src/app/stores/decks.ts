import { create } from 'zustand';
import { deckStorage, type DeckSummary } from '../../core/decks/DeckStorageService';
import { DeckSerializer } from '../../core/decks/DeckSerializer';
import type { DeckCardLists, DeckImportSource } from '../../core/decks/types';
import { readJson, writeJson } from './persist';

export interface StarterDeck {
  file: string;
  name: string;
  cards: number;
  cover: { name: string; setCode: string; cardNumber: string };
}

/** A deck in the roster: one the player saved, or a starter deck not saved yet. */
export interface RosterDeck {
  id: string;
  name: string;
  note: string;
  cardCount: number;
  cover: { name?: string; setCode: string; cardNumber: string } | null;
  colors: string[];
  starter: StarterDeck | null;
  /** the deck website it was imported from */
  source?: DeckImportSource;
}

const SELECTED_KEY = 'playmat.selectedDeck';
const SLEEVES_KEY = 'playmat.sleeves';
export const STARTER_PREFIX = 'starter:';

const COLOR_ORDER = ['white', 'blue', 'black', 'red', 'green'] as const;
const COLOR_LETTER: Record<(typeof COLOR_ORDER)[number], string> = { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G' };

/** Sleeve colors: matte dyes, picked to stay readable around card art. */
export const SLEEVE_COLORS = ['#20302b', '#1f2a44', '#3b1f2b', '#4a2a17', '#2c2c2e', '#3e3a2a', '#24403f', '#5a2320'];

function summaryToRoster(deck: DeckSummary): RosterDeck {
  const colors = COLOR_ORDER.filter((color) => deck.colors?.[color]).map((color) => COLOR_LETTER[color]);
  const size = `${deck.cardCount ?? 0} cards${deck.sideboardCount ? ` + ${deck.sideboardCount}` : ''}`;
  return {
    id: deck.id,
    name: deck.name || 'Untitled deck',
    note: deck.format ? `${deck.format.replace(/^Constructed - /, '')} · ${size}` : size,
    cardCount: deck.cardCount ?? 0,
    cover: deck.coverCard ?? null,
    colors,
    starter: null,
    source: deck.source,
  };
}

function starterToRoster(starter: StarterDeck): RosterDeck {
  return {
    id: STARTER_PREFIX + starter.file,
    name: starter.name,
    note: `Starter deck · ${starter.cards} cards`,
    cardCount: starter.cards,
    cover: starter.cover,
    colors: [],
    starter,
  };
}

export interface DeckLibraryState {
  saved: RosterDeck[];
  starters: StarterDeck[];
  selectedId: string | null;
  sleeves: Record<string, string>;
  loaded: boolean;
  refresh(): Promise<void>;
  select(id: string): void;
  setSleeve(id: string, color: string): void;
  /** the deck list to send to the server; starter decks are saved to the library on first use */
  loadForPlay(id: string): Promise<{ deck: DeckCardLists; id: string }>;
  /** a deck from the import sheet, saved as a new deck and selected */
  saveImported(deck: DeckCardLists): Promise<string>;
  /** a deck brought up to date with its site, under its own id */
  saveUpdated(deck: DeckCardLists): Promise<void>;
  remove(id: string): Promise<void>;
}

async function fetchStarters(): Promise<StarterDeck[]> {
  try {
    const response = await fetch('/starter-decks/index.json');
    return response.ok ? ((await response.json()) as StarterDeck[]) : [];
  } catch {
    return [];
  }
}

export const useDecks = create<DeckLibraryState>((set, get) => ({
  saved: [],
  starters: [],
  selectedId: readJson<string | null>(SELECTED_KEY, null),
  sleeves: readJson<Record<string, string>>(SLEEVES_KEY, {}),
  loaded: false,

  async refresh() {
    const [summaries, starters] = await Promise.all([deckStorage.listDecks(), get().starters.length ? get().starters : fetchStarters()]);
    const saved = summaries.map(summaryToRoster);
    let selectedId = get().selectedId;
    const known = new Set([...saved.map((deck) => deck.id), ...starters.map((starter) => STARTER_PREFIX + starter.file)]);
    if (!selectedId || !known.has(selectedId)) {
      selectedId = saved[0]?.id ?? (starters[0] ? STARTER_PREFIX + starters[0].file : null);
    }
    set({ saved, starters, selectedId, loaded: true });
  },

  select(id) {
    writeJson(SELECTED_KEY, id);
    set({ selectedId: id });
  },

  setSleeve(id, color) {
    const sleeves = { ...get().sleeves, [id]: color };
    writeJson(SLEEVES_KEY, sleeves);
    set({ sleeves });
  },

  async loadForPlay(id) {
    if (id.startsWith(STARTER_PREFIX)) {
      const starter = get().starters.find((candidate) => STARTER_PREFIX + candidate.file === id);
      if (!starter) throw new Error('That starter deck is not available.');
      const response = await fetch(`/starter-decks/${encodeURIComponent(starter.file)}`);
      const text = response.ok ? await response.text() : '';
      if (!text || /^\s*</.test(text)) throw new Error(`Couldn't load ${starter.name}.`);
      const deck = DeckSerializer.importDeck(text);
      deck.name = starter.name;
      deck.format = 'Constructed - Freeform';
      deck.coverCard = starter.cover;
      const savedId = await deckStorage.saveDeck(deck, { forceNew: true });
      const sleeve = get().sleeves[id];
      await get().refresh();
      if (sleeve) get().setSleeve(savedId, sleeve);
      get().select(savedId);
      return { deck, id: savedId };
    }
    const deck = await deckStorage.loadDeck(id);
    if (!deck) throw new Error('That deck is no longer saved.');
    return { deck, id };
  },

  async saveImported(deck) {
    const id = await deckStorage.saveDeck({ ...deck, id: undefined }, { forceNew: true });
    await get().refresh();
    get().select(id);
    return id;
  },

  async saveUpdated(deck) {
    await deckStorage.saveDeck(deck);
    await get().refresh();
  },

  async remove(id) {
    await deckStorage.deleteDeck(id);
    await get().refresh();
  },
}));

export function rosterOf(state: Pick<DeckLibraryState, 'saved' | 'starters'>): RosterDeck[] {
  const savedNames = new Set(state.saved.map((deck) => deck.name));
  // starters already saved by the player don't show twice
  return [...state.saved, ...state.starters.filter((starter) => !savedNames.has(starter.name)).map(starterToRoster)];
}

export function sleeveFor(sleeves: Record<string, string>, deck: RosterDeck | null | undefined): string {
  if (!deck) return SLEEVE_COLORS[0];
  if (sleeves[deck.id]) return sleeves[deck.id];
  // a stable default per deck
  let hash = 0;
  for (const char of deck.name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return SLEEVE_COLORS[hash % SLEEVE_COLORS.length];
}
