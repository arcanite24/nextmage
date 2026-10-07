import { createContext, useContext } from 'react';

export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

export interface StageContextValue {
  scale: number;
  element: HTMLDivElement | null;
}

export const StageContext = createContext<StageContextValue>({ scale: 1, element: null });

export function useStage() {
  return useContext(StageContext);
}

/** Converts a viewport point to stage coordinates. */
export function toStagePoint(stage: StageContextValue, clientX: number, clientY: number) {
  const rect = stage.element?.getBoundingClientRect();
  if (!rect) return { x: clientX, y: clientY };
  return { x: (clientX - rect.left) / stage.scale, y: (clientY - rect.top) / stage.scale };
}

/** Center of a board object (card, player plate, stack item) in stage coordinates. */
export function useObjectCenter() {
  const stage = useStage();
  return (id: string): { x: number; y: number } | null => {
    const element = stage.element?.querySelector(`[data-object-id="${CSS.escape(id)}"]`);
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return toStagePoint(stage, box.left + box.width / 2, box.top + box.height / 2);
  };
}
