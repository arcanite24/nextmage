import { create } from 'zustand';
import { api } from '../connection';
import { useDecks, STARTER_PREFIX } from './decks';
import { useEvents } from './events';
import { useSession } from './session';
import { toWire } from '../decks/deckModel';
import type { DeckCardLists as WireDeck } from '../../protocol/generated/views';

/** the smallest deck worth a game (limited size; constructed formats are checked by the server) */
const MIN_DECK_SIZE = 40;

export type PlayPhase = 'idle' | 'starting' | 'waitingForGame';

export interface AiOptions {
  /** server AI strength, 1-10 */
  skill: number;
  /** the AI's deck: a starter deck file, or null for a random starter */
  starterFile: string | null;
}

interface PlayState {
  phase: PlayPhase;
  error: string | null;
  tableId: string | null;
  /** the deck of the latest game against the AI (for its sleeve and for playing again) */
  deckId: string | null;
  lastOptions: Partial<AiOptions>;
  playVsAi(deckId: string, options?: Partial<AiOptions>): Promise<void>;
  cancel(): Promise<void>;
}

async function aiDeck(starterFile: string | null): Promise<WireDeck> {
  const { starters } = useDecks.getState();
  const starter = starterFile
    ? starters.find((candidate) => candidate.file === starterFile)
    : starters[Math.floor(Math.random() * starters.length)];
  if (!starter) throw new Error('No deck available for the AI.');
  const response = await fetch(`/starter-decks/${encodeURIComponent(starter.file)}`);
  const text = response.ok ? await response.text() : '';
  if (!text || /^\s*</.test(text)) throw new Error(`Couldn't load the AI's deck (${starter.name}).`);
  const { DeckSerializer } = await import('../../services/DeckSerializer');
  const deck = DeckSerializer.importDeck(text);
  deck.name = starter.name;
  return toWire(deck);
}

export const usePlay = create<PlayState>((set, get) => ({
  phase: 'idle',
  error: null,
  tableId: null,
  deckId: null,
  lastOptions: {},

  async playVsAi(deckId, options = {}) {
    const { roomId, userName } = useSession.getState();
    if (!roomId) return;
    set({ phase: 'starting', error: null, deckId, lastOptions: options });
    // a game outside any event: leaving it goes back to Play
    useEvents.setState({ currentTournamentId: null });
    try {
      const { deck } = await useDecks.getState().loadForPlay(deckId);
      const size = deck.cards.reduce((sum, card) => sum + card.amount, 0);
      if (size < MIN_DECK_SIZE) {
        throw new Error(`${deck.name || 'This deck'} has ${size} ${size === 1 ? 'card' : 'cards'}. Decks need at least ${MIN_DECK_SIZE}; add more in the deck builder.`);
      }
      const opponentDeck = await aiDeck(options.starterFile ?? null);
      const table = await api.roomCreateTable(roomId, {
        name: `${userName} vs AI`,
        gameType: 'Two Player Duel',
        deckType: 'Constructed - Freeform',
        winsNeeded: 1,
        skillLevel: 'CASUAL',
        spectatorsAllowed: true,
        rollbackTurnsAllowed: true,
        playerTypes: ['HUMAN', 'COMPUTER_MAD'],
      });
      const tableId = table.tableId;
      if (!tableId) throw new Error('The server did not create the table.');
      set({ tableId });
      if (!await api.roomJoinTable(roomId, tableId, userName, 'HUMAN', 1, toWire(deck))) {
        throw new Error('Your deck was not accepted for this table.');
      }
      if (!await api.roomJoinTable(roomId, tableId, 'AI Opponent', 'COMPUTER_MAD', options.skill ?? 4, opponentDeck)) {
        throw new Error('The AI could not take its seat.');
      }
      set({ phase: 'waitingForGame' });
      if (!await api.matchStart(roomId, tableId)) throw new Error('The match could not start.');
    } catch (error) {
      const tableId = get().tableId;
      set({ phase: 'idle', error: error instanceof Error ? error.message : String(error), tableId: null });
      if (tableId && roomId) api.tableRemove(roomId, tableId).catch(() => undefined);
    }
  },

  async cancel() {
    const { roomId } = useSession.getState();
    const tableId = get().tableId;
    set({ phase: 'idle', tableId: null });
    if (roomId && tableId) await api.tableRemove(roomId, tableId).catch(() => undefined);
  },
}));

/** True while a deck id points at an unsaved starter deck. */
export function isStarter(deckId: string | null): boolean {
  return !!deckId && deckId.startsWith(STARTER_PREFIX);
}
