import { Crown, Lock } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useCardImage } from '../../core/images/useCardImage';
import { isDecoded, markDecoded } from '../ui/imageCache';
import { Portrait } from './ModeArt';
import styles from './Portraits.module.css';

/**
 * Career's faces: an opponent is shown by the art of their signature card in a frame, like a character select; until
 * the art arrives (or for one without a card) their drawn portrait stands in.
 */

export interface ArtCard {
  name?: string;
  setCode?: string;
  cardNumber?: string;
}

/**
 * A card's art crop filling its box. While the art is on its way the window stays dark and the art fades in when it
 * lands (at once when it was seen before); the drawn portrait from the name and colours is for a card without art.
 */
export function CardArt({ card, name, colors, boss, className }: { card?: ArtCard | null; name: string; colors?: string; boss?: boolean; className?: string }) {
  const src = useCardImage(card?.name ? card : null, 'front', 'art_crop');
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const picture = typeof src === 'string' && src !== failedSrc ? src : null;
  const loaded = !!picture && (loadedSrc === picture || isDecoded(picture));
  const drawn = !card?.name || src === undefined || (typeof src === 'string' && src === failedSrc);
  return (
    <span className={[styles.art, className ?? ''].join(' ')} aria-hidden="true" data-loaded={loaded || undefined}>
      {drawn && <span className={styles.drawn}><Portrait name={name} colors={colors} boss={boss} size={120} /></span>}
      {picture && (
        <img
          src={picture}
          alt=""
          decoding="async"
          onLoad={() => {
            markDecoded(picture);
            setLoadedSrc(picture);
          }}
          onError={() => setFailedSrc(picture)}
        />
      )}
    </span>
  );
}

/** Mana pips for a WUBRG string. */
export function Pips({ colors, size = 'md' }: { colors?: string; size?: 'sm' | 'md' }) {
  const letters = (colors ?? '').match(/[WUBRGC]/g) ?? [];
  return (
    <span className={[styles.pips, size === 'sm' ? styles.pipsSm : ''].join(' ')} aria-hidden="true">
      {letters.map((letter, index) => <i key={index} className={`ms ms-cost ms-${letter.toLowerCase()}`} />)}
    </span>
  );
}

/**
 * An opponent as a framed card: art on top, name plate below; `children` go in the plate's foot (wins, what a win
 * pays). Locked frames are sealed; a boss gets a crown. The whole frame is one button when `onPick` is given.
 */
export function PortraitCard({
  name, tagline, colors, cover, boss, locked, selected, size = 'md', onPick, label, children, className, style,
}: {
  name: string;
  tagline?: string;
  colors?: string;
  cover?: ArtCard | null;
  boss?: boolean;
  locked?: boolean;
  selected?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onPick?(): void;
  label?: string;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const body = (
    <>
      <span className={styles.window}>
        <CardArt card={cover} name={name} colors={colors} boss={boss} />
        {boss && <span className={styles.crown} aria-hidden="true"><Crown size={18} /></span>}
        {locked && <span className={styles.seal} aria-hidden="true"><Lock size={size === 'sm' ? 20 : 28} /></span>}
      </span>
      <span className={styles.plate}>
        <Pips colors={colors} size="sm" />
        <b className={styles.name}>{name}</b>
        {tagline && size !== 'sm' && <small className={styles.tagline}>{tagline}</small>}
        {children && <span className={styles.foot}>{children}</span>}
      </span>
    </>
  );
  const classes = [styles.card, styles[size], locked ? styles.locked : '', selected ? styles.selected : '', boss ? styles.boss : '', className ?? ''].join(' ');
  if (!onPick) return <div className={classes} style={style}>{body}</div>;
  return (
    <button type="button" className={classes} style={style} onClick={onPick} aria-label={label ?? name} aria-pressed={selected} data-nav>
      {body}
    </button>
  );
}
