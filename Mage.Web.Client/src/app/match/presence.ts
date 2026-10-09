import { create } from 'zustand';

interface PresenceState {
  /** players (by name) the server said dropped off, with when (epoch ms); gone again once they're back */
  offline: Record<string, number>;
  set(name: string, online: boolean): void;
  clear(): void;
}

/** Who at the table is disconnected, from the game chat's status lines (see presenceChange). */
export const usePresence = create<PresenceState>((set) => ({
  offline: {},
  set(name, online) {
    set((state) => {
      if (online ? !(name in state.offline) : name in state.offline) return state;
      const offline = { ...state.offline };
      if (online) delete offline[name];
      else offline[name] = Date.now();
      return { offline };
    });
  },
  clear: () => set({ offline: {} }),
}));
