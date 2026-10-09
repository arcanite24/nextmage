import { useEffect, useRef, useSyncExternalStore } from 'react';

/** How long a finger rests on a card before it opens the card's detail view (touch has no hover). */
export const LONG_PRESS_MS = 450;
/** How far, in window pixels, a finger may drift and still count as resting. */
export const PRESS_SLOP = 10;
/** After a long press, the click the browser makes from the lifted finger is dropped for this long. */
const CLICK_GRACE_MS = 700;

export interface LongPressOptions {
  /** The press was held: return true when it was used, so lifting the finger isn't also a tap. */
  onLongPress(target: Element, point: { x: number; y: number }): boolean;
  /** A press that has become something else (a drag) never turns into a long press. */
  isBusy?(): boolean;
  delay?: number;
}

/**
 * Long-press for touch and pen on everything inside `element`, delegated like the right click it stands in for.
 * A mouse never long-presses (it has hover and a right button). When a long press is used, the gesture the target
 * had started is cancelled with a `pointercancel` (so a card in hand isn't played or dragged), and the release and
 * its click are swallowed before React sees them. Returns the detach function.
 */
export function attachLongPress(element: HTMLElement, options: LongPressOptions): () => void {
  const view = element.ownerDocument.defaultView ?? window;
  let press: { id: number; x: number; y: number; target: Element; timer: ReturnType<typeof setTimeout> } | null = null;
  let swallowing: number | null = null;
  let swallowClickUntil = 0;

  const clear = () => {
    if (press) clearTimeout(press.timer);
    press = null;
  };

  const fire = () => {
    const current = press;
    press = null;
    if (!current || options.isBusy?.()) return;
    if (!options.onLongPress(current.target, { x: current.x, y: current.y })) return;
    swallowing = current.id;
    current.target.dispatchEvent(new view.PointerEvent('pointercancel', {
      bubbles: true,
      pointerId: current.id,
      pointerType: 'touch',
      isPrimary: true,
    }));
  };

  const onDown = (event: PointerEvent) => {
    clear();
    swallowing = null;
    if (event.pointerType === 'mouse' || !event.isPrimary || !(event.target instanceof view.Element)) return;
    press = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      target: event.target,
      timer: setTimeout(fire, options.delay ?? LONG_PRESS_MS),
    };
  };

  const onMove = (event: PointerEvent) => {
    if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > PRESS_SLOP) clear();
  };

  const onUp = (event: PointerEvent) => {
    if (press?.id === event.pointerId) clear();
    if (swallowing !== null && swallowing === event.pointerId) {
      swallowing = null;
      swallowClickUntil = performance.now() + CLICK_GRACE_MS;
      event.stopPropagation();
      event.preventDefault();
    }
  };

  const onCancel = (event: PointerEvent) => {
    // the browser took the touch (a scroll): no long press. Our own cancel arrives after the press is cleared.
    if (press?.id === event.pointerId) clear();
  };

  const onClick = (event: MouseEvent) => {
    if (performance.now() >= swallowClickUntil) return;
    swallowClickUntil = 0;
    event.stopPropagation();
    event.preventDefault();
  };

  element.addEventListener('pointerdown', onDown, true);
  view.addEventListener('pointermove', onMove, true);
  view.addEventListener('pointerup', onUp, true);
  view.addEventListener('pointercancel', onCancel, true);
  view.addEventListener('click', onClick, true);
  return () => {
    clear();
    element.removeEventListener('pointerdown', onDown, true);
    view.removeEventListener('pointermove', onMove, true);
    view.removeEventListener('pointerup', onUp, true);
    view.removeEventListener('pointercancel', onCancel, true);
    view.removeEventListener('click', onClick, true);
  };
}

/** `attachLongPress` for the lifetime of a component; the options may change between renders. */
export function useLongPress(element: HTMLElement | null, options: LongPressOptions) {
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  useEffect(() => {
    if (!element) return;
    return attachLongPress(element, {
      onLongPress: (target, point) => latest.current.onLongPress(target, point),
      isBusy: () => latest.current.isBusy?.() ?? false,
      delay: latest.current.delay,
    });
  }, [element]);
}

const COARSE_QUERY = '(pointer: coarse)';

function subscribeCoarse(onChange: () => void) {
  const query = typeof window !== 'undefined' ? window.matchMedia?.(COARSE_QUERY) : undefined;
  query?.addEventListener?.('change', onChange);
  return () => query?.removeEventListener?.('change', onChange);
}

function coarseNow() {
  return typeof window !== 'undefined' && !!window.matchMedia?.(COARSE_QUERY).matches;
}

/** Whether the main pointer is a finger (a tablet): taps need bigger targets and there is no hover. */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribeCoarse, coarseNow, () => false);
}

let lastPointer: string = 'mouse';
let tracking = false;

/** The kind of pointer that last touched the page ('mouse', 'touch' or 'pen'): on a hybrid device either may hover. */
export function lastPointerType(): string {
  if (!tracking && typeof window !== 'undefined') {
    tracking = true;
    const note = (event: PointerEvent) => {
      lastPointer = event.pointerType || 'mouse';
    };
    window.addEventListener('pointerdown', note, true);
    window.addEventListener('pointermove', note, true);
  }
  return lastPointer;
}
