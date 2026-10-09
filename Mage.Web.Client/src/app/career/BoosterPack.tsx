import { Lock } from 'lucide-react';
import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { useCardImage } from '../../core/images/useCardImage';
import { useT } from '../i18n';
import { isDecoded, markDecoded } from '../ui/imageCache';
import type { ArtCard } from './Portraits';
import styles from './BoosterPack.module.css';

/** A hue for a set's wrapper, so each set's packs look like their own (the same set always gets the same one). */
function wrapperHue(setCode: string): number {
  let hash = 0;
  for (const char of setCode) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

/** Scryfall's drawing of a set's symbol (an SVG in black); hidden when Scryfall has none under that code. */
export function SetSymbol({ setCode, className }: { setCode: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!setCode || failed) return null;
  return (
    <img
      className={[styles.symbol, className ?? ''].join(' ')}
      src={`https://svgs.scryfall.io/sets/${setCode.toLowerCase()}.svg`}
      alt=""
      aria-hidden="true"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export type PackState = 'sealed' | 'charging' | 'torn';

/**
 * A booster pack of a set, drawn: the set's card art on the wrapper, its symbol and name on the band, crimped ends and
 * a foil that catches the light. It tilts toward the pointer when `tilt` is on. Opening it, the parent moves `state`
 * from sealed to charging (it shakes and glows) to torn (the top strip rips away along a ragged line).
 */
export function BoosterPack({
  setCode, setName, cover, cards, size = 'md', locked, tilt, state = 'sealed', className, style, children,
}: {
  setCode: string;
  setName: string;
  cover?: ArtCard | null;
  /** how many cards it holds, printed on the foot */
  cards?: number;
  size?: 'sm' | 'md' | 'lg';
  locked?: boolean;
  tilt?: boolean;
  state?: PackState;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const pack = useRef<HTMLSpanElement>(null);
  const hue = wrapperHue(setCode || setName);

  // the tilt follows the pointer through CSS variables, without a render per move
  function onPointerMove(event: PointerEvent<HTMLSpanElement>) {
    const box = pack.current?.getBoundingClientRect();
    if (!tilt || !box || !pack.current) return;
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    pack.current.style.setProperty('--mx', `${Math.round(x * 100)}%`);
    pack.current.style.setProperty('--my', `${Math.round(y * 100)}%`);
    pack.current.style.setProperty('--ry', `${((x - 0.5) * 18).toFixed(2)}deg`);
    pack.current.style.setProperty('--rx', `${((0.5 - y) * 14).toFixed(2)}deg`);
  }
  function onPointerLeave() {
    pack.current?.style.removeProperty('--ry');
    pack.current?.style.removeProperty('--rx');
    pack.current?.style.removeProperty('--mx');
    pack.current?.style.removeProperty('--my');
  }

  const face = <PackFace setCode={setCode} setName={setName} cover={cover} cards={cards} />;
  return (
    <span
      ref={pack}
      className={[styles.pack, styles[size], locked ? styles.locked : '', tilt ? styles.tilt : '', styles[state], className ?? ''].join(' ')}
      style={{ '--hue': hue, ...style } as CSSProperties}
      onPointerMove={tilt ? onPointerMove : undefined}
      onPointerLeave={tilt ? onPointerLeave : undefined}
      aria-hidden="true"
    >
      <span className={styles.glow} />
      {/* the face twice, cut along the tear line: the cap rips off, the rest falls away */}
      <span className={[styles.body, styles.rest].join(' ')}>{face}</span>
      <span className={[styles.body, styles.cap].join(' ')}>{face}</span>
      <span className={styles.burst} />
      {locked && <span className={styles.seal}><Lock size={size === 'sm' ? 18 : 26} /></span>}
      {children}
    </span>
  );
}

function PackFace({ setCode, setName, cover, cards }: { setCode: string; setName: string; cover?: ArtCard | null; cards?: number }) {
  const t = useT();
  const src = useCardImage(cover?.name ? cover : null, 'front', 'art_crop');
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const picture = typeof src === 'string' ? src : null;
  const loaded = !!picture && (loadedSrc === picture || isDecoded(picture));
  return (
    <>
      <span className={styles.art} data-loaded={loaded || undefined}>
        {picture && (
          <img
            src={picture}
            alt=""
            decoding="async"
            onLoad={() => {
              markDecoded(picture);
              setLoadedSrc(picture);
            }}
          />
        )}
      </span>
      <span className={styles.crimp} />
      <span className={styles.band}>
        <SetSymbol setCode={setCode} />
        <b className={styles.name}>{setName}</b>
      </span>
      <span className={styles.foot}>
        <span className={styles.code}>{setCode}</span>
        <span>{cards ? t('career.pack.cards', { count: cards }) : t('career.pack.booster')}</span>
      </span>
      <span className={[styles.crimp, styles.crimpBottom].join(' ')} />
      <span className={styles.foil} />
    </>
  );
}
