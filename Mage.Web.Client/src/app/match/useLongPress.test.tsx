import { act, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { attachLongPress, LONG_PRESS_MS, PRESS_SLOP, useLongPress } from './useLongPress';

function pointer(type: string, init: { pointerType?: string; x?: number; y?: number; id?: number; primary?: boolean } = {}) {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: init.id ?? 1,
    pointerType: init.pointerType ?? 'touch',
    isPrimary: init.primary ?? true,
    clientX: init.x ?? 10,
    clientY: init.y ?? 10,
    button: 0,
  });
}

/** A stage with a card on it whose own handlers (like a card in hand) act on release, cancel and click. */
function setup(onLongPress = vi.fn(() => true), isBusy?: () => boolean) {
  const stage = document.createElement('div');
  const card = document.createElement('div');
  const art = document.createElement('img');
  card.appendChild(art);
  stage.appendChild(card);
  document.body.appendChild(stage);
  const released = vi.fn();
  const cancelled = vi.fn();
  const clicked = vi.fn();
  // the card's own gesture listens in the bubble phase, as React's delegated handlers do
  document.addEventListener('pointerup', released);
  document.addEventListener('pointercancel', cancelled);
  document.addEventListener('click', clicked);
  const detach = attachLongPress(stage, { onLongPress, isBusy });
  const cleanup = () => {
    detach();
    document.removeEventListener('pointerup', released);
    document.removeEventListener('pointercancel', cancelled);
    document.removeEventListener('click', clicked);
    stage.remove();
  };
  return { stage, card, art, onLongPress, released, cancelled, clicked, cleanup };
}

describe('attachLongPress', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('a finger held still on a card long-presses it, and the release is not a tap', () => {
    const t = setup();
    t.art.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(LONG_PRESS_MS - 1);
    expect(t.onLongPress).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(t.onLongPress).toHaveBeenCalledWith(t.art, { x: 10, y: 10 });
    // the card's gesture was cancelled, so it neither plays nor keeps dragging
    expect(t.cancelled).toHaveBeenCalledTimes(1);
    t.art.dispatchEvent(pointer('pointerup'));
    t.art.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(t.released).not.toHaveBeenCalled();
    expect(t.clicked).not.toHaveBeenCalled();
    t.cleanup();
  });

  test('a quick tap stays a tap: released and clicked as usual', () => {
    const t = setup();
    t.art.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(120);
    t.art.dispatchEvent(pointer('pointerup'));
    t.art.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(t.onLongPress).not.toHaveBeenCalled();
    expect(t.released).toHaveBeenCalledTimes(1);
    expect(t.clicked).toHaveBeenCalledTimes(1);
    t.cleanup();
  });

  test('a finger that moves (a drag, a scroll) never long-presses; a small tremble still does', () => {
    const t = setup();
    t.art.dispatchEvent(pointer('pointerdown'));
    t.art.dispatchEvent(pointer('pointermove', { x: 10 + PRESS_SLOP - 2, y: 12 }));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(t.onLongPress).toHaveBeenCalledTimes(1);
    t.art.dispatchEvent(pointer('pointerup'));

    t.art.dispatchEvent(pointer('pointerdown', { id: 2 }));
    t.art.dispatchEvent(pointer('pointermove', { id: 2, x: 10, y: 10 + PRESS_SLOP + 5 }));
    vi.advanceTimersByTime(LONG_PRESS_MS * 2);
    expect(t.onLongPress).toHaveBeenCalledTimes(1);
    t.art.dispatchEvent(pointer('pointerup', { id: 2 }));
    expect(t.released).toHaveBeenCalledTimes(1);
    t.cleanup();
  });

  test('a mouse never long-presses: it has hover and a right button', () => {
    const t = setup();
    t.art.dispatchEvent(pointer('pointerdown', { pointerType: 'mouse' }));
    vi.advanceTimersByTime(LONG_PRESS_MS * 2);
    expect(t.onLongPress).not.toHaveBeenCalled();
    t.cleanup();
  });

  test('a pen long-presses like a finger', () => {
    const t = setup();
    t.art.dispatchEvent(pointer('pointerdown', { pointerType: 'pen' }));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(t.onLongPress).toHaveBeenCalledTimes(1);
    t.cleanup();
  });

  test('when nothing uses the long press (not a card), the release goes through', () => {
    const t = setup(vi.fn(() => false));
    t.art.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(t.onLongPress).toHaveBeenCalledTimes(1);
    expect(t.cancelled).not.toHaveBeenCalled();
    t.art.dispatchEvent(pointer('pointerup'));
    expect(t.released).toHaveBeenCalledTimes(1);
    t.cleanup();
  });

  test('a press that became a drag is busy and is left alone', () => {
    const t = setup(vi.fn(() => true), () => true);
    t.art.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(t.onLongPress).not.toHaveBeenCalled();
    t.art.dispatchEvent(pointer('pointerup'));
    expect(t.released).toHaveBeenCalledTimes(1);
    t.cleanup();
  });

  test('a second finger (pinch, two-finger scroll) is not a press, and the browser taking the touch cancels it', () => {
    const t = setup();
    t.art.dispatchEvent(pointer('pointerdown', { id: 5, primary: false }));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    t.art.dispatchEvent(pointer('pointerdown', { id: 6 }));
    t.art.dispatchEvent(pointer('pointercancel', { id: 6 }));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(t.onLongPress).not.toHaveBeenCalled();
    t.cleanup();
  });

  test('detaching stops a pending press', () => {
    const t = setup();
    t.art.dispatchEvent(pointer('pointerdown'));
    t.cleanup();
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(t.onLongPress).not.toHaveBeenCalled();
  });
});

describe('useLongPress', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('a held card opens its detail; a tapped card is played', () => {
    const played = vi.fn();
    const opened = vi.fn();
    function Table() {
      const [element, setElement] = useState<HTMLDivElement | null>(null);
      useLongPress(element, {
        onLongPress: (target) => {
          const id = target.closest<HTMLElement>('[data-object-id]')?.dataset.objectId;
          if (!id) return false;
          opened(id);
          return true;
        },
      });
      return (
        <div ref={setElement}>
          {/* a card in hand: plays on release, unless its gesture was cancelled */}
          <div data-object-id="bolt" onPointerUp={() => played('bolt')} onPointerCancel={() => undefined}>Lightning Bolt</div>
        </div>
      );
    }
    const { getByText } = render(<Table />);
    const card = getByText('Lightning Bolt');

    act(() => {
      card.dispatchEvent(pointer('pointerdown'));
    });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    fireEvent(card, pointer('pointerup'));
    expect(opened).toHaveBeenCalledWith('bolt');
    expect(played).not.toHaveBeenCalled();

    act(() => {
      card.dispatchEvent(pointer('pointerdown', { id: 2 }));
    });
    fireEvent(card, pointer('pointerup', { id: 2 }));
    expect(played).toHaveBeenCalledWith('bolt');
    expect(opened).toHaveBeenCalledTimes(1);
  });
});
