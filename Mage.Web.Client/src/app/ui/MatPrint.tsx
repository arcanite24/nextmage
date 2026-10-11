import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useCardImage } from '../../core/images/useCardImage';
import type { CardImageRef } from '../../core/images/imageLinks';
import type { PressInk } from './printPress';
import styles from './MatPrint.module.css';

/** Device pixels per CSS pixel the print is pressed at: the art is soft, and a full-screen canvas is a lot of memory. */
const MAX_SCALE = 1.5;
const MAX_SIDE = 2400;

type Press = typeof import('./printPress');
let pressLoad: Promise<Press> | null = null;

/** The press is code only a mat needs: kept out of the entry chunk. */
function loadPress(): Promise<Press> {
  pressLoad ??= import('./printPress');
  return pressLoad;
}

/**
 * The art printed into the mat: a card's art crop as a two-color screen print in mat green and ivory.
 * Changing the card re-prints the mat. The print is pressed once into a canvas (see printPress); when the picture
 * can't be read back (no CORS), it is printed live with blended layers instead.
 */
export function MatPrint({ card, className }: { card: CardImageRef | null; className?: string }) {
  const src = useCardImage(card, 'front', 'art_crop');
  const [printed, setPrinted] = useState<{ src: string; layers: HTMLCanvasElement[] | null } | null>(null);
  const [run, setRun] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<PressInk | null>(null);
  const [kit, setKit] = useState<Press | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadPress().then((loaded) => !cancelled && setKit(loaded), () => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!kit || typeof src !== 'string' || src === printed?.src) return;
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const done = (layers: HTMLCanvasElement[] | null) => {
      if (cancelled) return;
      setPrinted({ src, layers });
      setRun((value) => value + 1);
    };
    image.onload = () => {
      try {
        done(kit.separate(image));
      } catch {
        done(null);
      }
    };
    // a picture that refuses CORS still loads as a plain background
    image.onerror = () => done(null);
    image.src = src;
    return () => {
      cancelled = true;
    };
  }, [kit, src, printed?.src]);

  const live = !!printed && !printed.layers;

  // press again when the art, the box or the mat's dye changes (the dye comes from an ancestor's style)
  useLayoutEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!kit || !box || !canvas || live) return;
    const draw = () => {
      const style = getComputedStyle(box);
      const ink = { dye: style.getPropertyValue('--print-dye').trim() || '#2f6b58', shade: style.getPropertyValue('--shade-rgb').trim() || '0 0 0' };
      const width = box.clientWidth;
      const height = box.clientHeight;
      if (!width || !height) return;
      const scale = Math.min(window.devicePixelRatio || 1, MAX_SCALE, MAX_SIDE / Math.max(width, height));
      inkRef.current = ink;
      kit.press(canvas, printed?.layers ?? [], width, height, scale, ink);
    };
    draw();
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    });
    observer.observe(box);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [kit, printed, live]);

  // the dye can change without the box changing (a new mat cloth): cheap to check on every render
  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    const ink = inkRef.current;
    if (!kit || !box || !canvas || live || !ink) return;
    const dye = getComputedStyle(box).getPropertyValue('--print-dye').trim() || '#2f6b58';
    if (dye === ink.dye) return;
    const scale = canvas.width / Math.max(1, box.clientWidth);
    inkRef.current = { ...ink, dye };
    kit.press(canvas, printed?.layers ?? [], box.clientWidth, box.clientHeight, scale, inkRef.current);
  });

  return (
    <div ref={boxRef} className={[styles.print, className ?? ''].join(' ')} aria-hidden="true">
      {live ? (
        <>
          <div key={run} className={styles.pass}>
            <div className={[styles.layer, styles.shadowInk].join(' ')} style={{ backgroundImage: `url("${printed.src}")` }} />
            <div className={[styles.layer, styles.lightInk].join(' ')} style={{ backgroundImage: `url("${printed.src}")` }} />
            <div className={[styles.layer, styles.keyInk].join(' ')} style={{ backgroundImage: `url("${printed.src}")` }} />
          </div>
          <div className={styles.dye} />
          <div className={styles.halftone} />
        </>
      ) : (
        <canvas key={run} ref={canvasRef} className={[styles.pressed, run ? styles.fresh : ''].join(' ')} />
      )}
    </div>
  );
}
