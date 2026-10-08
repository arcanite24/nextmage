import { useEffect, useState } from 'react';
import type { CardView, PermanentView } from '../../protocol/generated/views';
import { isStackAbility } from '../../core/game/cards';
import { AbilityCard } from '../ui/AbilityCard';
import { CardFace } from '../ui/CardFace';
import { useMatchUi } from './matchUi';
import { STAGE_HEIGHT, toStagePoint, useStage } from './stageContext';
import styles from './CardZoom.module.css';

const ZOOM_WIDTH = 340;
const ZOOM_HEIGHT = ZOOM_WIDTH * (88 / 63);
const DELAY_MS = 260;

/** The hovered card, large, beside the pointer (after a short delay so sweeping the board stays calm). */
export function CardZoom() {
  const zoom = useMatchUi((state) => state.zoom);
  const dragging = useMatchUi((state) => state.dragging);
  const detailOpen = useMatchUi((state) => !!state.detail);
  const stage = useStage();
  const [settled, setSettled] = useState<typeof zoom>(null);

  useEffect(() => {
    if (!zoom || dragging) return;
    const timer = setTimeout(() => setSettled(zoom), DELAY_MS);
    return () => clearTimeout(timer);
  }, [zoom, dragging]);

  // show the hovered card only once the pointer has rested on it
  const shown = zoom && !dragging && settled === zoom ? zoom : null;
  // a card that left its place while hovered (cast from hand, died) never reports the pointer leaving it
  // ...or that changed zone under the same id (a spell becoming a permanent): only the hovered element counts
  const element = shown?.anchor
    ?? (shown?.card.id ? stage.element?.querySelector(`[data-object-id="${CSS.escape(shown.card.id)}"]`) : null);
  if (!shown || detailOpen || !element || !element.isConnected || !element.matches(':hover')) return null;
  const point = toStagePoint(stage, shown.x, shown.y);
  const left = point.x > stage.width / 2 ? point.x - ZOOM_WIDTH - 60 : point.x + 60;
  const top = Math.max(24, Math.min(STAGE_HEIGHT - ZOOM_HEIGHT - 24, point.y - ZOOM_HEIGHT / 2));
  const card = shown.card as PermanentView;
  const back = card.secondCardFace;
  const extra = details(card);

  return (
    <div className={styles.zoom} style={{ left, top }} aria-hidden="true">
      <div className={styles.faces}>
        {isStackAbility(card)
          ? <AbilityCard ability={card} sleeve={shown.sleeve} style={{ width: ZOOM_WIDTH }} />
          : <CardFace card={card} size="large" sleeve={shown.sleeve} style={{ width: ZOOM_WIDTH }} />}
        {back && card.transformable && (
          <CardFace card={back} face="back" size="normal" sleeve={shown.sleeve} style={{ width: ZOOM_WIDTH * 0.62 }} />
        )}
      </div>
      {extra.length > 0 && (
        <ul className={styles.details}>
          {extra.map((line) => <li key={line}>{line}</li>)}
        </ul>
      )}
    </div>
  );
}

/** What the picture can't show: changed stats, counters, damage, who controls it. */
function details(card: PermanentView & CardView): string[] {
  const lines: string[] = [];
  if (card.power !== undefined && card.toughness !== undefined && (card.cardTypes ?? []).includes('CREATURE')) {
    const base = card.original;
    if (base && (base.power !== card.power || base.toughness !== card.toughness)) {
      lines.push(`Now ${card.power}/${card.toughness} (printed ${base.power}/${base.toughness})`);
    }
  }
  if ((card.damage ?? 0) > 0) lines.push(`${card.damage} damage marked`);
  for (const counter of card.counters ?? []) {
    if ((counter.count ?? 0) > 0) lines.push(`${counter.count} × ${counter.name}`);
  }
  if (card.nameController && card.nameOwner && card.nameOwner !== card.nameController) {
    lines.push(`Controlled by ${card.nameController}, owned by ${card.nameOwner}`);
  }

  return lines;
}
