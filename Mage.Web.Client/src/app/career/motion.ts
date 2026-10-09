import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useSettings } from '../stores/settings';
import { prefersReducedMotion } from './progressModel';

/**
 * Career's motion kit: the few moves every game-mode screen shares. Everything here is skippable, never holds input
 * for more than a beat, and goes still when the player turned animations off or asked the system for less motion.
 */

/** Longest a single Career move may take; sequences are made of these, and any click skips to the end. */
export const MAX_MOVE_MS = 1200;

/** Staggered entrances stop growing after this many items, so a long list never waits on its tail. */
export const DEAL_CAP = 10;

/** Whether Career should stay still: animations off in Settings, or reduced motion asked for by the system. */
export function useStill(): boolean {
  const animations = useSettings((settings) => settings.settings.animations);
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    const query = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)') : undefined;
    if (!query) return;
    const change = () => setReduced(query.matches);
    query.addEventListener?.('change', change);
    return () => query.removeEventListener?.('change', change);
  }, []);
  return !animations || reduced;
}

/** Style for the nth item of a staggered entrance (`.deal` in motion.module.css reads --deal). */
export function dealStyle(index: number, style?: CSSProperties): CSSProperties {
  return { ...style, '--deal': Math.min(Math.max(index, 0), DEAL_CAP) } as CSSProperties;
}

/** Eases a number toward its target: slow at the end, like coins landing. */
export function easeOut(progress: number): number {
  const p = Math.min(Math.max(progress, 0), 1);
  return 1 - (1 - p) ** 3;
}

/** The value a count-up shows at a moment of its run. */
export function countAt(from: number, to: number, elapsed: number, duration: number): number {
  if (duration <= 0 || elapsed >= duration) return to;
  return Math.round(from + (to - from) * easeOut(elapsed / duration));
}

/**
 * A number that counts up (or down) to its target once `run` turns true; still, it shows the target at once.
 * Changing the target later counts on from where it stands.
 */
export function useCountUp(target: number, { run = true, duration = 900, still = false }: { run?: boolean; duration?: number; still?: boolean } = {}): number {
  const [shown, setShown] = useState(still ? target : 0);
  const from = useRef(shown);
  // where a new run starts: the number on show when the target moved (kept in an effect, before the run's own)
  useEffect(() => {
    from.current = shown;
  });
  useEffect(() => {
    if (!run || still) return;
    const start = performance.now();
    const origin = from.current;
    const length = Math.min(duration, MAX_MOVE_MS);
    let frame = 0;
    const step = (now: number) => {
      const value = countAt(origin, target, now - start, length);
      setShown(value);
      if (value !== target) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, run, duration, still]);
  return still ? target : shown;
}

/**
 * A sequence of beats that advance by themselves: `step` goes 0, 1, 2 … up to `beats` with each beat's delay, and
 * `skip()` jumps to the end. Still, it starts at the end.
 */
export function useSequence(delays: readonly number[], still: boolean): { step: number; done: boolean; skip(): void } {
  const beats = delays.length;
  const [step, setStep] = useState(still ? beats : 0);
  useEffect(() => {
    if (step >= beats) return;
    const timer = window.setTimeout(() => setStep((current) => current + 1), Math.min(delays[step] ?? 0, MAX_MOVE_MS));
    return () => window.clearTimeout(timer);
  }, [step, beats, delays]);
  const skip = useCallback(() => setStep(beats), [beats]);
  return { step, done: step >= beats, skip };
}
