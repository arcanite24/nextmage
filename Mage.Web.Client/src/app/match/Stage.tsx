import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { DEFAULT_STAGE, fitStage, StageContext, type StageContextValue } from './stageContext';
import { useCoarsePointer } from './useLongPress';
import styles from './Stage.module.css';

/** The smallest tap target on a touch screen, in window pixels. */
const TOUCH_TARGET = 44;

/**
 * The match is laid out at 1080 stage pixels tall and scaled to the window, like a game: nothing reflows or scrolls
 * and every zone keeps its place. The stage is 1920 wide at 16:9 and widens with wider windows, so the battlefield
 * reaches the edges of anything wider than 16:9, up to a 21:9 monitor; the side columns are anchored to the stage edges.
 * Narrower windows keep 1920 and the mat fills above and below.
 *
 * A portrait window (a tablet held upright) gets the tall layout instead: 1080 wide and as tall as the window's shape
 * asks, with the zones re-placed for it (`data-layout="tall"` on the stage). On a touch screen the stage publishes
 * `--touch-target`, the stage pixels that make a 44 pixel tap target at the current scale.
 */
export function Stage({ children, background }: { children: ReactNode | ((stage: StageContextValue) => ReactNode); background?: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<StageContextValue>(DEFAULT_STAGE);
  const stageRef = useRef<HTMLDivElement>(null);
  const coarse = useCoarsePointer();

  useLayoutEffect(() => {
    const update = () => {
      const box = frame.current?.getBoundingClientRect();
      if (!box) return;
      if (!box.width || !box.height) return;
      const fit = fitStage(box.width, box.height);
      setStage((previous) => (previous.scale === fit.scale && previous.width === fit.width && previous.height === fit.height
        && previous.layout === fit.layout && previous.element === stageRef.current
        ? previous
        : { ...fit, element: stageRef.current }));
    };
    update();
    const observer = new ResizeObserver(update);
    if (frame.current) observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);

  const style = {
    width: stage.width,
    height: stage.height,
    transform: `translate(-50%, -50%) scale(${stage.scale})`,
    '--stage-height': `${stage.height}px`,
    ...(coarse ? { '--touch-target': `${Math.ceil(TOUCH_TARGET / stage.scale)}px` } : {}),
  } as CSSProperties;

  return (
    <div ref={frame} className={styles.frame}>
      {background}
      <div ref={stageRef} className={styles.stage} style={style} data-layout={stage.layout} data-touch={coarse ? '' : undefined}>
        <StageContext.Provider value={stage}>{typeof children === 'function' ? children(stage) : children}</StageContext.Provider>
      </div>
    </div>
  );
}
