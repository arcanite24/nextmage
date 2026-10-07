import { useLayoutEffect, type RefObject } from 'react';
import { useStage } from './stageContext';

/**
 * Cards fly between zones: every card element records where it was (in stage coordinates, keyed by the
 * physical card id). When a card appears somewhere new, it starts from its last known place and travels
 * to its new one (FLIP). Zones register fallback origins (a player's library, an opponent's hidden hand).
 */

interface Placement {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  at: number;
}

const placements = new Map<string, Placement>();
const origins = new Map<string, Placement>();
const MEMORY_MS = 4_000;
let motionEnabled = true;

export function setCardMotion(enabled: boolean) {
  motionEnabled = enabled;
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function measure(element: HTMLElement, stageElement: HTMLElement | null, scale: number, rotation: number): Placement | null {
  if (!stageElement) return null;
  const box = element.getBoundingClientRect();
  const stageBox = stageElement.getBoundingClientRect();
  if (box.width === 0 && box.height === 0) return null;
  return {
    x: (box.left - stageBox.left) / scale,
    y: (box.top - stageBox.top) / scale,
    width: box.width / scale,
    height: box.height / scale,
    rotation,
    at: performance.now(),
  };
}

/** A zone that cards come from or vanish into (library, hidden hand, graveyard pile). */
export function useFlipOrigin(key: string, ref: RefObject<HTMLElement | null>) {
  const stage = useStage();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const placement = measure(element, stage.element, stage.scale, 0);
    if (placement) origins.set(key, { ...placement, at: Number.POSITIVE_INFINITY });
  });
}

/**
 * Animate a card element from wherever that card was last seen.
 * `fallbackOrigin` names a zone to fly from when the card was never on screen (a draw, an opponent's cast).
 */
export function useFlip(cardId: string | undefined, ref: RefObject<HTMLElement | null>, options: { rotation?: number; fallbackOrigin?: string } = {}) {
  const stage = useStage();
  const rotation = options.rotation ?? 0;

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !cardId || !stage.element) return;
    // a card in flight is measured where it lands, not mid-air
    if (element.getAnimations().some((animation) => animation.playState === 'running')) return;
    const now = measure(element, stage.element, stage.scale, rotation);
    if (!now) return;
    const before = placements.get(cardId);
    const recent = before && performance.now() - before.at < MEMORY_MS ? before : null;
    const from = recent ?? (options.fallbackOrigin ? origins.get(options.fallbackOrigin) ?? null : null);
    placements.set(cardId, now);

    if (!from || !motionEnabled || reducedMotion()) return;
    const dx = from.x + from.width / 2 - (now.x + now.width / 2);
    const dy = from.y + from.height / 2 - (now.y + now.height / 2);
    const scale = from.width / Math.max(1, now.width);
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2 && Math.abs(scale - 1) < 0.02) return;

    const flight = element.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(${from.rotation - rotation}deg)`, zIndex: 50 },
        { transform: 'translate(0, 0) scale(1) rotate(0deg)', zIndex: 50 },
      ],
      { duration: Math.min(560, 260 + Math.hypot(dx, dy) * 0.25), easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    );
    flight.onfinish = () => {
      const landed = measure(element, stage.element, stage.scale, rotation);
      if (landed) placements.set(cardId, landed);
    };
  });

  // remember the final place when the card leaves this zone
  useLayoutEffect(() => {
    const element = ref.current;
    return () => {
      if (!element || !cardId || !stage.element) return;
      const last = measure(element, stage.element, stage.scale, rotation);
      if (last) placements.set(cardId, last);
    };
  }, [cardId, ref, stage, rotation]);
}
