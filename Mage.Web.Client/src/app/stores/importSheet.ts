import { create } from 'zustand';
import type { DeckPayload } from '../../core/deckImport/payload';
import type { DeckCardLists } from '../../core/decks/types';

/** What the import sheet opens with: typed or pasted text, a dropped file, or a deck the bookmarklet sent. */
export type ImportSeed =
  | { kind: 'text'; text: string }
  | { kind: 'file'; name: string; text: string }
  | { kind: 'payload'; payload: DeckPayload };

/** Where the imported deck goes: a new deck on the shelf, or into the deck open in the builder. */
export type ImportTarget =
  | { kind: 'new' }
  | { kind: 'into'; mode: 'replace' | 'add'; deckName: string; apply(deck: DeckCardLists): void };

interface ImportSheetState {
  open: boolean;
  /** bumps on every open, so the sheet starts fresh even when it was already open */
  session: number;
  seed: ImportSeed | null;
  target: ImportTarget;
  /** the deck just saved, so the shelf can play its arrival */
  arrivedId: string | null;
  show(seed?: ImportSeed | null, target?: ImportTarget): void;
  close(): void;
  markArrived(id: string): void;
}

/** The one import sheet, opened from the Decks shelf, Home, the deck builder, a paste, a drop or /import. */
export const useImportSheet = create<ImportSheetState>((set, get) => ({
  open: false,
  session: 0,
  seed: null,
  target: { kind: 'new' },
  arrivedId: null,
  show(seed = null, target = { kind: 'new' }) {
    set({ open: true, session: get().session + 1, seed, target });
  },
  close() {
    set({ open: false, seed: null });
  },
  markArrived(id) {
    set({ arrivedId: id });
    setTimeout(() => {
      if (get().arrivedId === id) set({ arrivedId: null });
    }, 2400);
  },
}));

export function openImport(seed?: ImportSeed | null, target?: ImportTarget) {
  useImportSheet.getState().show(seed, target);
}
