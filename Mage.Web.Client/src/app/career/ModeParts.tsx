import { Star } from 'lucide-react';
import { useT } from '../i18n';
import { useLastModeResult, type ModeKind } from './careerModesData';
import { starSlots, type Line } from './careerModesModel';
import styles from './CareerModes.module.css';

/** The pieces every Career mode screen shares: rewards and twists as lines, stars, the last result. */

/** Message lines as a list (rewards, twists); nothing when there are none. */
export function LineList({ lines, className, label }: { lines: readonly Line[]; className?: string; label?: string }) {
  const t = useT();
  if (lines.length === 0) return null;
  return (
    <ul className={[styles.lines, className ?? ''].join(' ')} aria-label={label}>
      {lines.map((line, index) => <li key={`${line.key}-${index}`}>{t(line.key, line.vars)}</li>)}
    </ul>
  );
}

/** 0 to 3 stars, drawn and said */
export function Stars({ stars, size = 16 }: { stars: number | undefined; size?: number }) {
  const t = useT();
  const slots = starSlots(stars);
  const lit = slots.filter(Boolean).length;
  return (
    <span className={styles.stars} role="img" aria-label={t('career.puzzle.stars', { count: lit })}>
      {slots.map((on, index) => <Star key={index} size={size} aria-hidden="true" className={on ? styles.starOn : styles.starOff} fill={on ? 'currentColor' : 'none'} />)}
    </span>
  );
}

/** What the last game of this mode paid, from the server's summary of it. */
export function ModeResult({ kind }: { kind: ModeKind }) {
  const t = useT();
  const result = useLastModeResult(kind).data;
  const mode = result?.mode;
  if (!result || !mode) return null;
  return (
    <section className={[styles.result, result.won ? styles.resultWon : ''].join(' ')} aria-label={t('career.modes.lastGame')} role="status">
      <h2 className={styles.resultTitle}>
        {t(result.won ? 'career.modes.won' : 'career.modes.lost')}
        {mode.title ? ` · ${mode.title}` : ''}
      </h2>
      {mode.stars ? <Stars stars={mode.stars} /> : null}
      {(mode.lines ?? []).length > 0 && (
        <ul className={styles.lines}>
          {(mode.lines ?? []).map((line, index) => <li key={index}>{line}</li>)}
        </ul>
      )}
      {(mode.coins || mode.xp) ? <p className={styles.small}>{t('career.recent.paid', { coins: mode.coins ?? 0, xp: mode.xp ?? 0 })}</p> : null}
    </section>
  );
}
