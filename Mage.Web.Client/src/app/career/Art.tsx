import { useState, type CSSProperties, type ReactNode } from 'react';
import { artUrl, usePaintedArt, type ArtKind } from './careerArt';
import styles from './CareerArt.module.css';

/**
 * One painted picture, or its `fallback` (the drawn SVG or CSS version) when painted art is off or the picture
 * can't load. Decorative unless given a label; it keeps its box while loading, so layouts don't jump.
 */
export function Art({ kind, id, size, label, className, style, fallback = null }: {
  kind: ArtKind;
  id: string;
  size: number;
  label?: string;
  className?: string;
  style?: CSSProperties;
  fallback?: ReactNode;
}) {
  const painted = usePaintedArt();
  const src = artUrl(kind, id);
  const [failed, setFailed] = useState<string | null>(null);
  if (!painted || failed === src) return <>{fallback}</>;
  return (
    <img
      src={src}
      width={size}
      height={kind === 'sleeve' ? Math.round((size * 7) / 5) : size}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={[styles.art, className ?? ''].join(' ')}
      style={style}
      onError={() => setFailed(src)}
    />
  );
}
