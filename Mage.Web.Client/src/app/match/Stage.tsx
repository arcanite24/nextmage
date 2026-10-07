import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { MAX_STAGE_WIDTH, STAGE_HEIGHT, STAGE_WIDTH, StageContext, type StageContextValue } from './stageContext';
import styles from './Stage.module.css';

/**
 * The match is laid out at 1080 stage pixels tall and scaled to the window, like a game: nothing reflows or scrolls
 * and every zone keeps its place. The stage is 1920 wide at 16:9 and widens with wider windows, so the battlefield
 * reaches the edges of a 16:10 laptop as well as a 21:9 monitor; the side columns are anchored to the stage edges.
 * Narrower windows keep 1920 and the mat fills above and below.
 */
export function Stage({ children, background }: { children: ReactNode | ((width: number) => ReactNode); background?: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<StageContextValue>({ scale: 1, element: null, width: STAGE_WIDTH });
  const stageRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const update = () => {
      const box = frame.current?.getBoundingClientRect();
      if (!box) return;
      if (!box.width || !box.height) return;
      const width = Math.round(Math.min(MAX_STAGE_WIDTH, Math.max(STAGE_WIDTH, STAGE_HEIGHT * (box.width / box.height))));
      const scale = Math.min(box.width / width, box.height / STAGE_HEIGHT);
      setStage((previous) => (previous.scale === scale && previous.width === width && previous.element === stageRef.current
        ? previous
        : { scale, element: stageRef.current, width }));
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
        style={{ width: stage.width, height: STAGE_HEIGHT, transform: `translate(-50%, -50%) scale(${stage.scale})` }}
      >
        <StageContext.Provider value={stage}>{typeof children === 'function' ? children(stage.width) : children}</StageContext.Provider>
      </div>
    </div>
  );
}
