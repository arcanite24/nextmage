import { create } from 'zustand';
import { api } from '../connection';
import { useDecks, STARTER_PREFIX } from './decks';
import { useEvents } from './events';
import { warmCards } from '../ui/imageCache';
import { useSession } from './session';
import { readJson, writeJson } from './persist';
import { deckStorage } from '../../core/decks/DeckStorageService';
import { toWire } from '../decks/deckModel';
import type { DeckCardLists as WireDeck } from '../../protocol/generated/views';

/** the smallest deck worth a game (limited size; constructed formats are checked by the server) */
const MIN_DECK_SIZE = 40;

export type PlayPhase = 'idle' | 'starting' | 'waitingForGame';

export type AiType = 'COMPUTER_MAD' | 'COMPUTER_MONTE_CARLO';

export interface AiOptions {
  /** server AI strength, 1-10 */
  skill: number;
  /** the AI's deck: a deck id from the roster (saved or starter:<file>), or null for a random starter */
  opponentDeckId: string | null;
  aiType: AiType;
  /** games needed to win the match: 1 (best of one) or 2 (best of three) */
  winsNeeded: 1 | 2;
  startingLife: 20 | 30 | 40;
}

const AI_OPTIONS_KEY = 'playmat.aiOptions';

export const DEFAULT_AI_OPTIONS: AiOptions = {
  skill: 4,
  opponentDeckId: null,
  aiType: 'COMPUTER_MAD',
  winsNeeded: 1,
  startingLife: 20,
};

interface PlayState {
  phase: PlayPhase;
  error: string | null;
  tableId: string | null;
  /** the deck of the latest game against the AI (for its sleeve and for playing again) */
  deckId: string | null;
  lastOptions: Partial<AiOptions>;
  /** how games against the AI are set up (kept in this browser) */
  aiOptions: AiOptions;
  setAiOptions(patch: Partial<AiOptions>): void;
  playVsAi(deckId: string, options?: Partial<AiOptions>): Promise<void>;
  cancel(): Promise<void>;
}

async function aiDeck(deckId: string | null): Promise<WireDeck> {
  // one of the player's saved decks
  if (deckId && !deckId.startsWith(STARTER_PREFIX)) {
    const saved = await deckStorage.loadDeck(deckId);
    if (saved) return toWire(saved);
  }
  const { starters } = useDecks.getState();
  const starterFile = deckId?.startsWith(STARTER_PREFIX) ? deckId.slice(STARTER_PREFIX.length) : null;
  const starter = starterFile
    ? starters.find((candidate) => candidate.file === starterFile)
    : starters[Math.floor(Math.random() * starters.length)];
  if (!starter) throw new Error('No deck available for the AI.');
  const response = await fetch(`/starter-decks/${encodeURIComponent(starter.file)}`);
  const text = response.ok ? await response.text() : '';
  if (!text || /^\s*</.test(text)) throw new Error(`Couldn't load the AI's deck (${starter.name}).`);
  const { DeckSerializer } = await import('../../core/decks/DeckSerializer');
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
  aiOptions: { ...DEFAULT_AI_OPTIONS, ...readJson<Partial<AiOptions>>(AI_OPTIONS_KEY, {}) },

  setAiOptions(patch) {
    const aiOptions = { ...get().aiOptions, ...patch };
    writeJson(AI_OPTIONS_KEY, aiOptions);
    set({ aiOptions });
  },

  async playVsAi(deckId, overrides = {}) {
    const { roomId, userName } = useSession.getState();
    if (!roomId) return;
    const options: AiOptions = { ...get().aiOptions, ...overrides };
    set({ phase: 'starting', error: null, deckId, lastOptions: overrides });
    // a game outside any event: leaving it goes back to Play
    useEvents.setState({ currentTournamentId: null });
    try {
      const { deck } = await useDecks.getState().loadForPlay(deckId);
      // both decks' pictures download while the table is set up, before the first card is drawn: nothing either
      // player casts should wait on the network
      warmCards([...deck.cards, ...deck.sideboard].map((card) => ({ name: card.cardName, setCode: card.setCode ?? undefined, cardNumber: card.cardNumber ?? undefined })));
      const size = deck.cards.reduce((sum, card) => sum + card.amount, 0);
      if (size < MIN_DECK_SIZE) {
        throw new Error(`${deck.name || 'This deck'} has ${size} ${size === 1 ? 'card' : 'cards'}. Decks need at least ${MIN_DECK_SIZE}; add more in the deck builder.`);
      }
      const opponentDeck = await aiDeck(options.opponentDeckId);
      warmCards([...(opponentDeck.cards ?? []), ...(opponentDeck.sideboard ?? [])].map((card) => ({ name: card.cardName, setCode: card.setCode, cardNumber: card.cardNumber })));
      const table = await api.roomCreateTable(roomId, {
        name: `${userName} vs AI`,
        gameType: 'Two Player Duel',
        deckType: 'Constructed - Freeform',
        winsNeeded: options.winsNeeded,
        customStartLifeEnabled: options.startingLife !== 20,
        customStartLife: options.startingLife,
        skillLevel: 'CASUAL',
        spectatorsAllowed: true,
        rollbackTurnsAllowed: true,
        playerTypes: ['HUMAN', options.aiType],
      });
      const tableId = table.tableId;
      if (!tableId) throw new Error('The server did not create the table.');
      set({ tableId });
      if (!await api.roomJoinTable(roomId, tableId, userName, 'HUMAN', 1, toWire(deck))) {
        throw new Error('Your deck was not accepted for this table.');
      }
      if (!await api.roomJoinTable(roomId, tableId, 'AI Opponent', options.aiType, options.skill, opponentDeck)) {
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
