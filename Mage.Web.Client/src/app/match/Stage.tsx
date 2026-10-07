import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { STAGE_HEIGHT, STAGE_WIDTH, StageContext, type StageContextValue } from './stageContext';
import styles from './Stage.module.css';

/**
 * The match is laid out once at 1920x1080 and scaled to the window, like a game: nothing reflows or scrolls,
 * every zone keeps its place, and the mat fills the margins.
 */
export function Stage({ children, background }: { children: ReactNode; background?: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<StageContextValue>({ scale: 1, element: null });
  const stageRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const update = () => {
      const box = frame.current?.getBoundingClientRect();
      if (!box) return;
      const scale = Math.min(box.width / STAGE_WIDTH, box.height / STAGE_HEIGHT);
      setStage({ scale, element: stageRef.current });
    };
    update();
    const observer = new ResizeObserver(update);
    if (frame.current) observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frame} className={styles.frame}>
      {background}
      <div
        ref={stageRef}
        className={styles.stage}
        style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, transform: `translate(-50%, -50%) scale(${stage.scale})` }}
      >
        <StageContext.Provider value={stage}>{children}</StageContext.Provider>
      </div>
    </div>
  );
}
