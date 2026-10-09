import { create } from 'zustand';

export type DeckSyncStatus = 'off' | 'syncing' | 'synced' | 'error';

/** Whether decks are kept on the server for this account, and how the last sync went (see stores/deckSync). */
export const useDeckSyncStatus = create<{ status: DeckSyncStatus; lastSyncedAt: number | null; error: string | null }>(() => ({
  status: 'off',
  lastSyncedAt: null,
  error: null,
}));
