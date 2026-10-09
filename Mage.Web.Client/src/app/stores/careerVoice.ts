import { create } from 'zustand';

/** What a Career opponent says at the table: before the game, at a big play, at low life, and at the end. */
export interface VoiceLines {
  intro?: string;
  bigPlay?: string;
  lowLife?: string;
  /** when they win */
  win?: string;
  /** when they lose */
  lose?: string;
  /** at a pod, the seat that speaks (the others keep quiet) */
  speaker?: string;
}

interface CareerVoiceState {
  lines: VoiceLines | null;
  speak(lines: VoiceLines | null): void;
}

/** The voice of the Career game being started (or played); null for a game whose opponent says nothing. */
export const useCareerVoice = create<CareerVoiceState>((set) => ({
  lines: null,
  speak: (lines) => set({ lines }),
}));
