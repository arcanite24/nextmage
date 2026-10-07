import { useEffect, useState } from 'react';
import { useMatchUi } from './matchUi';
import { STAGE_HEIGHT, STAGE_WIDTH, toStagePoint, useObjectCenter, useStage } from './stageContext';
import styles from './Arrows.module.css';

interface Point {
  x: number;
  y: number;
}

function curve(from: Point, to: Point): string {
  const mx = (from.x + to.x) / 2;
  const my = Math.min(from.y, to.y) - Math.abs(to.x - from.x) * 0.18 - 40;
  return `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`;
}

/**
 * Arrows on the table: what the top of the stack targets (ink), and while choosing targets,
 * a live arrow from the spell to the pointer (amber).
 */
export function Arrows({ sourceId, targetIds, live, links }: {
  sourceId: string | null;
  targetIds: string[];
  live: boolean;
  /** blocker -> attacker pairs in the current combat */
  links: [string, string][];
}) {
  const center = useObjectCenter();
  const stage = useStage();
  const [, setTick] = useState(0);
  const [pointer, setPointer] = useState<Point | null>(null);
  const dragging = useMatchUi((state) => state.dragging);

  const targetKey = targetIds.join(',') + '|' + links.map((link) => link.join('>')).join(',');
  // positions change as cards fly in; re-measure for a moment after changes
  useEffect(() => {
    let frames = 0;
    let handle = 0;
    const loop = () => {
      setTick((value) => value + 1);
      if (++frames < 40) handle = requestAnimationFrame(loop);
    };
    handle = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(handle);
  }, [sourceId, targetKey]);

  useEffect(() => {
    if (!live) {
      setPointer(null);
      return;
    }
    const onMove = (event: PointerEvent) => setPointer(toStagePoint(stage, event.clientX, event.clientY));
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [live, stage]);

  const from = sourceId ? center(sourceId) : null;
  const targets = from ? targetIds.map(center).filter((point): point is Point => !!point) : [];
  const combat = links
    .map(([blocker, attacker]) => [center(blocker), center(attacker)] as const)
    .filter((pair): pair is readonly [Point, Point] => !!pair[0] && !!pair[1]);
  if (dragging || (combat.length === 0 && (!from || (targets.length === 0 && !(live && pointer))))) return null;

  return (
    <svg className={styles.arrows} width={STAGE_WIDTH} height={STAGE_HEIGHT} aria-hidden="true">
      <defs>
        <marker id="arrow-ink" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--ink)" />
        </marker>
        <marker id="arrow-decision" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--decision)" />
        </marker>
      </defs>
      {combat.map(([blocker, attacker], index) => (
        <line key={`c${index}`} className={styles.block} x1={blocker.x} y1={blocker.y} x2={attacker.x} y2={attacker.y} />
      ))}
      {from && targets.map((to, index) => (
        <path key={index} className={styles.ink} d={curve(from, to)} markerEnd="url(#arrow-ink)" />
      ))}
      {from && live && pointer && <path className={styles.live} d={curve(from, pointer)} markerEnd="url(#arrow-decision)" />}
    </svg>
  );
}
