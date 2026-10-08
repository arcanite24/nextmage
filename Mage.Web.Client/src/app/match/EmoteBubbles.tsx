import { useLayoutEffect, useState } from 'react';
import type { GameView } from '../../protocol/generated/views';
import { useEmotes, type EmoteBubble } from './emotes';
import { toStagePoint, useStage } from './stageContext';
import styles from './EmoteBubbles.module.css';

/** Emotes as short speech bubbles beside the sender's seat. */
export function EmoteBubbles({ view }: { view: GameView | null }) {
  const bubbles = useEmotes((state) => state.bubbles);
  const players = view?.players;
  return (
    <>
      {bubbles.map((bubble) => {
        const playerId = players?.find((player) => player.name === bubble.from)?.playerId;
        return playerId ? <Bubble key={bubble.key} bubble={bubble} playerId={playerId} /> : null;
      })}
    </>
  );
}

function Bubble({ bubble, playerId }: { bubble: EmoteBubble; playerId: string }) {
  const stage = useStage();
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  // the seat is measured once the bubble mounts: seats don't move while a bubble lasts
  useLayoutEffect(() => {
    const plate = stage.element?.querySelector(`[data-object-id="${CSS.escape(playerId)}"]`);
    if (!plate) return;
    const box = plate.getBoundingClientRect();
    const corner = toStagePoint(stage, box.right, box.top);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- measuring the DOM must happen after layout
    setAt({ left: corner.x + 14, top: corner.y + 6 });
  }, [stage, playerId]);
  if (!at) return null;
  return (
    <div className={styles.bubble} style={at} role="status" aria-label={`${bubble.from}: ${bubble.text}`}>
      {bubble.text}
    </div>
  );
}
