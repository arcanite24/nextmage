import { create } from 'zustand';
import { addRule, clearRules, type AutoRule, type AutoRuleKind } from '../../core/game/autoAnswer';

/**
 * The standing answers the player set in each game, as the client remembers them. The server keeps the real ones
 * for the game's lifetime; this list exists to show them in Settings and reset them.
 */
interface AutoAnswersState {
  rules: AutoRule[];
  /** games answering the trigger order by themselves ("Order automatically") until the triggers are on the stack */
  autoOrdering: Record<string, boolean>;
  remember(rule: AutoRule): void;
  forget(gameId: string, kind: AutoRuleKind): void;
  forgetGame(gameId: string): void;
  setAutoOrdering(gameId: string, on: boolean): void;
}

export const useAutoAnswers = create<AutoAnswersState>((set) => ({
  rules: [],
  autoOrdering: {},
  remember: (rule) => set((state) => ({ rules: addRule(state.rules, rule) })),
  forget: (gameId, kind) => set((state) => ({ rules: clearRules(state.rules, gameId, kind) })),
  forgetGame: (gameId) => set((state) => {
    const autoOrdering = { ...state.autoOrdering };
    delete autoOrdering[gameId];
    return { rules: state.rules.filter((rule) => rule.gameId !== gameId), autoOrdering };
  }),
  setAutoOrdering: (gameId, on) => set((state) => (
    !!state.autoOrdering[gameId] === on ? state : { autoOrdering: { ...state.autoOrdering, [gameId]: on } }
  )),
}));
