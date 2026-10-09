import { create } from 'zustand';
import type { CoachTip } from '../../core/game/coach';
import { readJson, writeJson } from './persist';

const COACH_KEY = 'playmat.coach';

interface Saved {
  /** tips already shown */
  seen: CoachTip[];
  /** the guided first game was played (or skipped) */
  firstGameDone: boolean;
}

interface CoachState extends Saved {
  /** the game being played is the guided one: tips show */
  guided: boolean;
  setGuided(on: boolean): void;
  markSeen(tip: CoachTip): void;
  /** the guided game is over, or the player turned the tips off */
  finish(): void;
}

function save(state: Saved) {
  writeJson<Saved>(COACH_KEY, { seen: state.seen, firstGameDone: state.firstGameDone });
}

export const useCoach = create<CoachState>((set, get) => ({
  ...{ seen: [], firstGameDone: false, ...readJson<Partial<Saved>>(COACH_KEY, {}) },
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
}));
