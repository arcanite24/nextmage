import { useEffect, useState } from 'react';
import { toStagePoint, useStage } from './stageContext';

export interface StageBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where board objects (by data-object-id) sit on the stage, re-measured for a moment after they change, as cards fly in. */
export function useObjectBoxes(ids: readonly string[]): ReadonlyMap<string, StageBox> {
  const stage = useStage();
  const [boxes, setBoxes] = useState<ReadonlyMap<string, StageBox>>(new Map());
  const key = ids.join(',');

  useEffect(() => {
    let frames = 0;
    let handle = 0;
    const measure = () => {
      const next = new Map<string, StageBox>();
      for (const id of key ? key.split(',') : []) {
        const element = stage.element?.querySelector(`[data-object-id="${CSS.escape(id)}"]`);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        const topLeft = toStagePoint(stage, rect.left, rect.top);
        next.set(id, { x: topLeft.x, y: topLeft.y, width: rect.width / stage.scale, height: rect.height / stage.scale });
      }
      setBoxes((previous) => (sameBoxes(previous, next) ? previous : next));
      if (++frames < 40) handle = requestAnimationFrame(measure);
    };
    handle = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(handle);
  }, [key, stage]);

  return boxes;
}

function sameBoxes(a: ReadonlyMap<string, StageBox>, b: ReadonlyMap<string, StageBox>): boolean {
  if (a.size !== b.size) return false;
  for (const [id, box] of b) {
    const other = a.get(id);
    if (!other || Math.abs(other.x - box.x) > 0.5 || Math.abs(other.y - box.y) > 0.5
      || Math.abs(other.width - box.width) > 0.5 || Math.abs(other.height - box.height) > 0.5) return false;
  }
  return true;
}
