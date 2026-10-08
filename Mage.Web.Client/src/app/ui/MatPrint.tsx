import { useEffect, useState } from 'react';
import { useCardImage } from '../../core/images/useCardImage';
import type { CardImageRef } from '../../core/images/imageLinks';
import styles from './MatPrint.module.css';

/**
 * The art printed into the mat: a card's art crop as a two-color screen print in mat green and ivory.
 * Changing the card re-prints the mat: the separations slide into register.
 */
export function MatPrint({ card, className }: { card: CardImageRef | null; className?: string }) {
  const src = useCardImage(card, 'front', 'art_crop');
  const [printed, setPrinted] = useState<string | null>(null);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (typeof src !== 'string' || src === printed) return;
    const image = new Image();
    image.onload = () => {
      setPrinted(src);
      setRun((value) => value + 1);
    };
    image.src = src;
  }, [src, printed]);

  return (
    <div className={[styles.print, className ?? ''].join(' ')} aria-hidden="true">
      {printed && (
        <div key={run} className={styles.pass}>
          <div className={[styles.layer, styles.shadowInk].join(' ')} style={{ backgroundImage: `url("${printed}")` }} />
          <div className={[styles.layer, styles.lightInk].join(' ')} style={{ backgroundImage: `url("${printed}")` }} />
          <div className={[styles.layer, styles.keyInk].join(' ')} style={{ backgroundImage: `url("${printed}")` }} />
        </div>
      )}
      <div className={styles.dye} />
      <div className={styles.halftone} />
    </div>
  );
}
