import { create } from 'zustand';

export interface EmoteBubble {
  key: number;
  /** sender's player name, as the chat names them */
  from: string;
  text: string;
}

const BUBBLE_MS = 3200;

interface EmotesState {
  bubbles: EmoteBubble[];
  /** games whose opponents are muted: their emotes and chat stay hidden */
  muted: Record<string, boolean>;
  show(from: string, text: string): void;
  toggleMute(gameId: string): void;
  clear(): void;
}

let nextKey = 0;

/** Emotes shown as short-lived bubbles on the sender's seat, and the per-game mute. */
export const useEmotes = create<EmotesState>((set) => ({
  bubbles: [],
  muted: {},
  show(from, text) {
    const key = ++nextKey;
    // one bubble per player: a new emote replaces the last
    set((state) => ({ bubbles: [...state.bubbles.filter((bubble) => bubble.from !== from), { key, from, text }] }));
    setTimeout(() => set((state) => ({ bubbles: state.bubbles.filter((bubble) => bubble.key !== key) })), BUBBLE_MS);
  },
  toggleMute(gameId) {
    set((state) => ({
      muted: { ...state.muted, [gameId]: !state.muted[gameId] },
      bubbles: state.muted[gameId] ? state.bubbles : [],
    }));
  },
  clear: () => set({ bubbles: [] }),
}));
