import { useState, type CSSProperties } from 'react';
import { useCardImage } from '../../core/images/useCardImage';
import type { CardFace as Face, CardImageRef, ImageSize } from '../../core/images/imageLinks';
import { ManaCost } from './ManaCost';
import styles from './CardFace.module.css';

export interface CardFaceProps {
  card: CardImageRef & {
    manaCostLeftStr?: string[];
    manaCost?: string;
    typeText?: string;
    power?: string;
    toughness?: string;
    rules?: string[];
  };
  face?: Face;
  size?: ImageSize;
  /** sleeve color; the deck's sleeves frame every card the player owns */
  sleeve?: string;
  /** show the back of the card (hidden information) */
  hidden?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * A card at real proportions, in its sleeve. While the picture loads (or when there is none) a printed text frame
 * with name, cost and type keeps the card readable and the layout stable.
 */
export function CardFace({ card, face = 'front', size = 'normal', sleeve, hidden, className, style }: CardFaceProps) {
  const src = useCardImage(hidden ? null : card, face, size);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = typeof src === 'string' && src !== failedSrc;
  const loaded = showImage && loadedSrc === src;
  const name = card.displayName ?? card.name ?? '';

  return (
    <div
      className={[styles.sleeve, className ?? ''].join(' ')}
      style={{ ...(sleeve ? { '--sleeve': sleeve } : {}), ...style } as CSSProperties}
      data-loaded={loaded || undefined}
    >
      <div className={styles.card}>
        {hidden ? (
          <div className={styles.back} aria-label="Hidden card" role="img" />
        ) : (
          <>
            {!loaded && (
              <div className={styles.frame} aria-hidden={showImage ? true : undefined}>
                <div className={styles.titleBar}>
                  <span className={styles.name}>{name}</span>
                  <ManaCost cost={card.manaCostLeftStr ?? card.manaCost} size="sm" />
                </div>
                <div className={styles.art} />
                {card.typeText && <div className={styles.typeLine}>{card.typeText}</div>}
                {card.power !== undefined && card.toughness !== undefined && card.power !== '' && (
                  <div className={styles.pt}>{card.power}/{card.toughness}</div>
                )}
              </div>
            )}
            {showImage && (
              <img
                className={styles.image}
                src={src}
                alt={name}
                loading="lazy"
                decoding="async"
                draggable={false}
                onLoad={() => setLoadedSrc(src)}
                onError={() => setFailedSrc(src)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
