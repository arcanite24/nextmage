import { useEffect, useRef, type RefObject } from 'react';

/**
 * Console-style menus for Career: arrow keys (or a gamepad's d-pad and left stick) move focus to the nearest
 * control in that direction, Enter or the gamepad's A button presses it, and Escape or B steps back. Controls opt in
 * with a `data-nav` attribute; typing in a field and open dialogs are left alone.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const KEYS: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

/**
 * The box to move to from `from` in a direction: the nearest one whose centre lies that way, preferring boxes in
 * line with the move (a step right stays on the same row when it can). Null when nothing lies that way.
 */
export function nearest(from: Box, boxes: readonly Box[], direction: Direction): number | null {
  const cx = from.left + from.width / 2;
  const cy = from.top + from.height / 2;
  let best: number | null = null;
  let bestScore = Infinity;
  boxes.forEach((box, index) => {
    if (box === from) return;
    const x = box.left + box.width / 2 - cx;
    const y = box.top + box.height / 2 - cy;
    const along = direction === 'left' ? -x : direction === 'right' ? x : direction === 'up' ? -y : y;
    const across = direction === 'left' || direction === 'right' ? Math.abs(y) : Math.abs(x);
    if (along <= 1) return;
    // off-line boxes count as further away, so rows and columns are followed first
    const score = along + across * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

function typing(element: Element | null): boolean {
  if (!element) return false;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (element as HTMLElement).isContentEditable;
}

function dialogOpen(): boolean {
  return !!document.querySelector('[role="dialog"], [role="alertdialog"]');
}

function targets(root: HTMLElement): HTMLElement[] {
  const scope = root.ownerDocument;
  return [...scope.querySelectorAll<HTMLElement>('[data-nav]')].filter((element) => {
    if ((element as HTMLButtonElement).disabled || element.closest('[inert]')) return false;
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  });
}

function move(root: HTMLElement, direction: Direction): boolean {
  const all = targets(root);
  if (all.length === 0) return false;
  const active = document.activeElement as HTMLElement | null;
  const from = active && all.includes(active) ? active : null;
  if (!from) {
    // the first press lands on the screen's first control
    const first = all.find((element) => root.contains(element)) ?? all[0];
    first.focus();
    return true;
  }
  const boxes = all.map((element) => element.getBoundingClientRect());
  const index = nearest(boxes[all.indexOf(from)], boxes, direction);
  if (index === null) return false;
  all[index].focus();
  all[index].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  return true;
}

/** Arrow keys, Escape and a gamepad drive the Career screen inside `root`; `back` is Escape's and B's step back. */
export function useMenuNav(root: RefObject<HTMLElement | null>, back: () => void) {
  const backRef = useRef(back);
  useEffect(() => {
    backRef.current = back;
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const element = root.current;
      if (!element || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (typing(document.activeElement) || dialogOpen()) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        backRef.current();
        return;
      }
      const direction = KEYS[event.key];
      if (direction && move(element, direction)) event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [root]);

  // a gamepad, polled while one is connected: d-pad or stick to move (repeating while held), A to press, B to go back
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('getGamepads' in navigator)) return;
    let frame = 0;
    let held: Direction | null = null;
    let heldSince = 0;
    let lastRepeat = 0;
    const pressed = new Set<number>();
    const poll = (now: number) => {
      const pad = [...navigator.getGamepads()].find(Boolean);
      const element = root.current;
      if (pad && element && !dialogOpen()) {
        const stickX = pad.axes[0] ?? 0;
        const stickY = pad.axes[1] ?? 0;
        const direction: Direction | null = pad.buttons[12]?.pressed || stickY < -0.6 ? 'up'
          : pad.buttons[13]?.pressed || stickY > 0.6 ? 'down'
            : pad.buttons[14]?.pressed || stickX < -0.6 ? 'left'
              : pad.buttons[15]?.pressed || stickX > 0.6 ? 'right' : null;
        if (direction !== held) {
          held = direction;
          heldSince = now;
          lastRepeat = now;
          if (direction) move(element, direction);
        } else if (direction && now - heldSince > 420 && now - lastRepeat > 140) {
          lastRepeat = now;
          move(element, direction);
        }
        for (const [button, act] of [[0, () => (document.activeElement as HTMLElement | null)?.click()], [1, () => backRef.current()]] as const) {
          const down = !!pad.buttons[button]?.pressed;
          if (down && !pressed.has(button)) act();
          if (down) pressed.add(button);
          else pressed.delete(button);
        }
      }
      frame = requestAnimationFrame(poll);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(poll);
    };
    const stop = () => {
      if (![...navigator.getGamepads()].some(Boolean)) cancelAnimationFrame(frame);
    };
    window.addEventListener('gamepadconnected', start);
    window.addEventListener('gamepaddisconnected', stop);
    if ([...navigator.getGamepads()].some(Boolean)) start();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('gamepadconnected', start);
      window.removeEventListener('gamepaddisconnected', stop);
    };
  }, [root]);
}
