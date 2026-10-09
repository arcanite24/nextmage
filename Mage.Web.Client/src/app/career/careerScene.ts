import { useEffect } from 'react';
import { create } from 'zustand';
import type { CardImageRef } from '../../core/images/imageLinks';

/**
 * The art printed behind Career's current screen: each screen names its card (the next opponent, the chapter's boss,
 * the deck's cover) and the shell re-prints the mat with it. Null keeps the last print.
 */
interface SceneState {
  art: CardImageRef | null;
  setArt(art: CardImageRef | null): void;
}

export const useCareerScene = create<SceneState>((set, get) => ({
  art: null,
  setArt(art) {
    const current = get().art;
    if (art && current && art.name === current.name && art.setCode === current.setCode && art.cardNumber === current.cardNumber) return;
    if (art) set({ art });
  },
}));

/** A screen's backdrop: the card whose art fills the mat while it is open. */
export function useSceneArt(card: { name?: string; setCode?: string; cardNumber?: string } | null | undefined) {
  const name = card?.name;
  const setCode = card?.setCode;
  const cardNumber = card?.cardNumber;
  useEffect(() => {
    if (name) useCareerScene.getState().setArt({ name, setCode, cardNumber });
  }, [name, setCode, cardNumber]);
}
