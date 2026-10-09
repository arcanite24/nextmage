import { create } from 'zustand';
import type { CoachTip } from '../../core/game/coach';
import { readJson, writeJson } from './persist';

const COACH_KEY = 'playmat.coach';
/** after this many finished games the player has found their way: Home stops offering the guided game */
export const GAMES_BEFORE_NO_GUIDE = 3;

interface Saved {
  /** tips already shown */
  seen: CoachTip[];
  /** the guided first game was played (or skipped) */
  firstGameDone: boolean;
  /** games played to the end, counted until the guided game is no longer offered */
  gamesPlayed: number;
}

interface CoachState extends Saved {
  /** the game being played is the guided one: tips show */
  guided: boolean;
  setGuided(on: boolean): void;
  markSeen(tip: CoachTip): void;
  /** the guided game is over, or the player turned the tips off */
  finish(): void;
  /** a game the player sat in ended */
  gamePlayed(): void;
}

function save(state: Saved) {
  writeJson<Saved>(COACH_KEY, { seen: state.seen, firstGameDone: state.firstGameDone, gamesPlayed: state.gamesPlayed });
}

export const useCoach = create<CoachState>((set, get) => ({
  ...{ seen: [], firstGameDone: false, gamesPlayed: 0, ...readJson<Partial<Saved>>(COACH_KEY, {}) },
  guided: false,

  setGuided(on) {
    // a new guided game teaches from the start
    set(on ? { guided: true, seen: [] } : { guided: false });
  },

  markSeen(tip) {
    if (get().seen.includes(tip)) return;
    const seen = [...get().seen, tip];
    set({ seen });
    save({ ...get(), seen });
  },

  finish() {
    set({ guided: false, firstGameDone: true });
    save({ ...get(), firstGameDone: true });
  },

  gamePlayed() {
    if (get().firstGameDone) return;
    const gamesPlayed = get().gamesPlayed + 1;
    const firstGameDone = gamesPlayed >= GAMES_BEFORE_NO_GUIDE;
    set({ gamesPlayed, firstGameDone });
    save({ ...get(), gamesPlayed, firstGameDone });
  },
}));
