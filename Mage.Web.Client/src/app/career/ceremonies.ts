import { create } from 'zustand';
import type { CareerAchievement } from '../../protocol/generated/views';
import type { useT } from '../i18n';
import type { CareerCue } from './careerSound';
import { describePay, describeReward } from './progressModel';

/**
 * Career's moments: the first time something opens (a tier of opponents, a campaign chapter, a set in the shop), a
 * short full-screen moment says so instead of a line of text. They queue up and show one at a time; a click, Enter
 * or Escape moves on.
 */
export interface CeremonyMoment {
  /** what the moment is for, so the same unlock never queues twice */
  id: string;
  kicker: string;
  title: string;
  text?: string;
  /** a card whose art fills the moment, or a crest drawn from a name and colours */
  card?: { name?: string; setCode?: string; cardNumber?: string };
  crest?: { name: string; colors?: string };
  cue?: CareerCue;
}

interface CeremonyState {
  queue: CeremonyMoment[];
  show(moments: CeremonyMoment[]): void;
  next(): void;
}

export const useCeremonies = create<CeremonyState>((set, get) => ({
  queue: [],
  show(moments) {
    const known = new Set(get().queue.map((moment) => moment.id));
    const fresh = moments.filter((moment) => !known.has(moment.id));
    if (fresh.length > 0) set({ queue: [...get().queue, ...fresh] });
  },
  next() {
    set({ queue: get().queue.slice(1) });
  },
}));

/** An achievement's moment: its name, what it asked, and what it paid. */
export function achievementMoment(t: ReturnType<typeof useT>, achievement: CareerAchievement): CeremonyMoment {
  const pay = [describePay(t, achievement.coins, achievement.xp), achievement.cosmetic ? describeReward(t, [{ kind: 'cosmetic', cosmetic: achievement.cosmetic }]) : '']
    .filter(Boolean).join(' · ');
  return {
    id: `achievement:${achievement.id}`,
    kicker: t('career.ceremony.achievement'),
    title: achievement.name ?? '',
    text: [achievement.text, pay].filter(Boolean).join(' — '),
    crest: { name: achievement.name ?? '', colors: 'C' },
    cue: 'levelUp',
  };
}
