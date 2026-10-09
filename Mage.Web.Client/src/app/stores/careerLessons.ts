import { create } from 'zustand';
import type { LessonTip } from '../../core/game/lessons';

/** A school duel's teaching, for the table it was started on: tips in the game and a word while sideboarding. */
export interface CareerLessonPlan {
  /** the Career table these belong to; another game shows none of it */
  tableId: string | null;
  tips: LessonTip[];
  /** shown while sideboarding between games of a best of three */
  sideboard: string | null;
}

interface CareerLessonsState {
  plan: CareerLessonPlan | null;
  /** the tips already shown in this game (each game of a match has them again) */
  shown: { gameId: string; tips: number[] };
  /** the player asked for no more tips in this match */
  quiet: boolean;
  teach(plan: CareerLessonPlan | null): void;
  /** the table the plan is for, once the server set it */
  seat(tableId: string | null): void;
  markShown(gameId: string, tip: number): void;
  hush(): void;
}

export const useCareerLessons = create<CareerLessonsState>((set) => ({
  plan: null,
  shown: { gameId: '', tips: [] },
  quiet: false,
  teach: (plan) => set({ plan, shown: { gameId: '', tips: [] }, quiet: false }),
  seat: (tableId) => set((state) => (state.plan ? { plan: { ...state.plan, tableId } } : state)),
  markShown: (gameId, tip) => set((state) => ({
    shown: { gameId, tips: state.shown.gameId === gameId ? [...new Set([...state.shown.tips, tip])] : [tip] },
  })),
  hush: () => set({ quiet: true }),
}));

/** The plan for this table, or null. */
export function lessonsFor(plan: CareerLessonPlan | null, tableId: string | null | undefined): CareerLessonPlan | null {
  return plan && tableId && plan.tableId === tableId ? plan : null;
}
