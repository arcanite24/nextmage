import type { AiOptions, AiType } from '../stores/play';

/** The server AI's skill (1-10) behind each difficulty. */
export const DIFFICULTIES: { label: string; skill: number; detail: string }[] = [
  { label: 'Easy', skill: 1, detail: 'Plays its cards, rarely plans ahead.' },
  { label: 'Normal', skill: 4, detail: 'Sensible attacks and blocks.' },
  { label: 'Hard', skill: 7, detail: 'Looks further ahead each turn.' },
  { label: 'Expert', skill: 10, detail: 'Its deepest search; slower turns.' },
];

export const AI_TYPES: { value: AiType; label: string; detail: string }[] = [
  { value: 'COMPUTER_MAD', label: 'Standard', detail: 'The usual XMage AI.' },
  { value: 'COMPUTER_MONTE_CARLO', label: 'Monte Carlo', detail: 'Experimental; plays by simulation and thinks longer.' },
];

export function difficultyOf(skill: number) {
  return DIFFICULTIES.reduce((best, item) => (Math.abs(item.skill - skill) < Math.abs(best.skill - skill) ? item : best));
}

/** One line describing the AI setup, for the Play zone. */
export function describeAi(options: AiOptions, deckName: string | null): string {
  const parts = [
    `${difficultyOf(options.skill).label} AI`,
    deckName ?? 'random starter deck',
    options.winsNeeded === 2 ? 'best of three' : 'best of one',
  ];
  if (options.startingLife !== 20) parts.push(`${options.startingLife} life`);
  return parts.join(' · ');
}
