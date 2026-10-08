import { createContext, useCallback, useContext } from 'react';

/** The reference layout: 1080 tall, and at least 1920 wide. */
export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;
/** Wider windows widen the stage (the battlefield grows) up to this; beyond it the mat fills the sides. */
export const MAX_STAGE_WIDTH = 2640;

export interface StageContextValue {
  scale: number;
  element: HTMLDivElement | null;
  /** the stage's current width in stage pixels, between STAGE_WIDTH and MAX_STAGE_WIDTH */
  width: number;
}

export const StageContext = createContext<StageContextValue>({ scale: 1, element: null, width: STAGE_WIDTH });

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
  // stable while the stage keeps its size, so effects can depend on it
  return useCallback((id: string): { x: number; y: number } | null => {
    const element = stage.element?.querySelector(`[data-object-id="${CSS.escape(id)}"]`);
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return toStagePoint(stage, box.left + box.width / 2, box.top + box.height / 2);
  }, [stage]);
}
