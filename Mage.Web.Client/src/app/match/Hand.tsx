import { useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { CardView } from '../../protocol/generated/views';
import { CardFace } from '../ui/CardFace';
import { zoneKeys } from './boardModel';
import { useFlip } from './flip';
import { useMatchUi } from './matchUi';
import { useStage } from './stageContext';
import styles from './Hand.module.css';

export interface HandProps {
  cards: CardView[];
  /** a prompt asks for cards from hand: eligible ones take the decision edge, the rest step back */
  choosing?: boolean;
  clickable: ReadonlySet<string>;
  selected: ReadonlySet<string>;
  sleeve: string;
  onPlay(id: string): void;
  /** stage y above which a dragged card counts as played */
  playLine: number;
  /** fly drawn cards from here */
  libraryOrigin: string;
  /** watching: the cards show their backs (an unknown hand, or one hidden for the broadcast) */
  faceDown?: boolean;
  /** the hand's accessible name (default: "Your hand") */
  label?: string;
}

const CARD_WIDTH = 168;
const DRAG_THRESHOLD = 12;

/** The player's hand, fanned along the bottom edge. Hover lifts a card; drag it up (or click it) to play it. */
export function Hand({ cards, choosing = false, clickable, selected, sleeve, onPlay, playLine, libraryOrigin, faceDown = false, label = 'Your hand' }: HandProps) {
  const count = cards.length;
  const spread = Math.min(CARD_WIDTH * 0.78, 1000 / Math.max(1, count));
  const arc = Math.min(4, 26 / Math.max(1, count));
  const width = spread * (count - 1) + CARD_WIDTH;
  const keys = useMemo(() => zoneKeys(cards), [cards]);

  return (
    <div className={styles.hand} style={{ width }} role="list" aria-label={`${label}, ${count} cards`}>
      {cards.map((card, index) => {
        const offset = index - (count - 1) / 2;
        return (
          <HandCard
            key={keys[index]}
            card={card}
            index={index}
            left={index * spread}
            rotate={offset * arc}
            drop={Math.abs(offset) * Math.abs(offset) * arc * 0.9}
            clickable={clickable.has(card.id!)}
            choosing={choosing}
            selected={selected.has(card.id!)}
            sleeve={sleeve}
            onPlay={onPlay}
            playLine={playLine}
            libraryOrigin={libraryOrigin}
            faceDown={faceDown}
          />
        );
      })}
    </div>
  );
}

interface HandCardProps {
  card: CardView;
  choosing: boolean;
  index: number;
  left: number;
  rotate: number;
  drop: number;
  clickable: boolean;
  selected: boolean;
  sleeve: string;
  onPlay(id: string): void;
  playLine: number;
  libraryOrigin: string;
  faceDown: boolean;
}

function HandCard({ card, choosing, index, left, rotate, drop, clickable, selected, sleeve, onPlay, playLine, libraryOrigin, faceDown }: HandCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const stage = useStage();
  const setZoom = useMatchUi((state) => state.setZoom);
  const setDragging = useMatchUi((state) => state.setDragging);
  const [drag, setDrag] = useState<{ dx: number; dy: number; moved: boolean } | null>(null);
  // the gesture lives in a ref: pointer events can arrive faster than React re-renders
  const gesture = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);
  useFlip(card.cardId ?? card.id, ref, { rotation: rotate, fallbackOrigin: libraryOrigin });

  function onPointerDown(event: ReactPointerEvent) {
    if (!clickable || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { startX: event.clientX, startY: event.clientY, moved: false };
  }

  function onPointerMove(event: ReactPointerEvent) {
    const current = gesture.current;
    if (!current) return;
    const dx = (event.clientX - current.startX) / stage.scale;
    const dy = (event.clientY - current.startY) / stage.scale;
    if (!current.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      current.moved = true;
      setDragging(card.id!);
      setZoom(null);
    }
    if (current.moved) setDrag({ dx, dy, moved: true });
  }

  function onPointerUp(event: ReactPointerEvent) {
    const current = gesture.current;
    if (!current) return;
    gesture.current = null;
    const stageTop = stage.element?.getBoundingClientRect().top ?? 0;
    // where the card was released, from the pointer (the element may not have re-rendered yet)
    const releaseY = (event.clientY - stageTop) / stage.scale;
    setDrag(null);
    setDragging(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!current.moved || releaseY < playLine) onPlay(card.id!);
  }

  const style: CSSProperties = drag?.moved
    ? { left, transform: `translate(${drag.dx}px, ${drag.dy}px) rotate(0deg) scale(1.08)`, zIndex: 100, transition: 'none' }
    : { left, ['--rotate' as string]: `${rotate}deg`, ['--drop' as string]: `${drop}px`, zIndex: index + 1 };

  return (
    <div
      ref={ref}
      role="listitem"
      className={[styles.card, faceDown ? styles.faceDown : '', clickable ? (choosing ? styles.choosable : styles.playable) : choosing ? styles.unchoosable : '', selected ? styles.selected : '', drag?.moved ? styles.dragging : ''].join(' ')}
      style={style}
      tabIndex={clickable ? 0 : -1}
      aria-label={`${faceDown ? 'Hidden card' : card.name ?? 'Card'}${clickable ? ', playable' : ''}${selected ? ', chosen' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        gesture.current = null;
        setDrag(null);
        setDragging(null);
      }}
      onKeyDown={(event) => {
        if (clickable && event.key === 'Enter') {
          event.preventDefault();
          onPlay(card.id!);
        }
      }}
      onPointerEnter={(event) => !drag && !faceDown && setZoom({ card, x: event.clientX, y: event.clientY, sleeve })}
      onPointerLeave={() => setZoom(null)}
      data-object-id={card.id}
    >
      <CardFace card={card} sleeve={sleeve} hidden={faceDown} />
    </div>
  );
}
