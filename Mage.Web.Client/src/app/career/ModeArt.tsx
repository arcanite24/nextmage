import { useId, useMemo, type CSSProperties } from 'react';
import { Art } from './Art';
import { usePaintedArt } from './careerArt';
import { ART_COLORS, crestArt, crestSpec, portraitArt, portraitSpec, type Sigil } from './careerModesModel';
import styles from './CareerArt.module.css';

/**
 * Career's own art: crests for schools, campaign chapters and runs, portraits for opponents without card art. Painted
 * (art/specs/crest.json and portrait.json) by default; with painted art off, drawn from a name and its colours (the
 * same name always draws the same picture), printed on the mat like the rest of Playmat.
 */

const SHIELD = 'M50 6 L90 16 C90 56 78 82 50 96 C22 82 10 56 10 16 Z';

function sigilPath(sigil: Sigil): string {
  switch (sigil) {
    case 'star':
      return 'M50 30 L55 45 L71 45 L58 54 L63 70 L50 60 L37 70 L42 54 L29 45 L45 45 Z';
    case 'tower':
      return 'M38 72 L38 44 L35 44 L35 34 L41 34 L41 39 L47 39 L47 34 L53 34 L53 39 L59 39 L59 34 L65 34 L65 44 L62 44 L62 72 Z M47 72 L47 62 C47 56 53 56 53 62 L53 72 Z';
    case 'eye':
      return 'M28 52 C38 38 62 38 72 52 C62 66 38 66 28 52 Z M50 44 A8 8 0 1 0 50.1 44 Z';
    case 'crown':
      return 'M32 68 L30 40 L41 52 L50 34 L59 52 L70 40 L68 68 Z';
    case 'flame':
      return 'M50 30 C60 42 66 50 64 60 C62 70 56 74 50 74 C44 74 36 70 36 60 C36 52 42 48 44 40 C46 48 50 50 52 48 C54 42 52 36 50 30 Z';
    case 'leaf':
      return 'M34 70 C34 46 48 34 68 32 C68 54 56 68 34 70 Z M34 70 L58 44';
    case 'moon':
      return 'M58 30 A22 22 0 1 0 58 74 A17 17 0 1 1 58 30 Z';
    case 'sword':
      return 'M48 28 L52 28 L53 58 L62 58 L62 62 L53 62 L53 70 L56 74 L44 74 L47 70 L47 62 L38 62 L38 58 L47 58 Z';
  }
}

/** A crest: a school's own (pass its id), or one in the name's colours. */
export function Crest({ name, colors, school, size = 56, label }: { name: string; colors?: string; school?: string; size?: number; label?: string }) {
  return (
    <Art kind="crest" id={crestArt(name, colors, school)} size={size} label={label} fallback={<DrawnCrest name={name} colors={colors} size={size} label={label} />} />
  );
}

function DrawnCrest({ name, colors, size, label }: { name: string; colors?: string; size: number; label?: string }) {
  const id = useId().replace(/:/g, '');
  const spec = useMemo(() => crestSpec(name, colors), [name, colors]);
  const first = ART_COLORS[spec.colors[0]] ?? ART_COLORS.C;
  const second = ART_COLORS[spec.colors[1] ?? spec.colors[0]] ?? first;
  const field = `url(#${id}-field)`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-field`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={first.light} />
          <stop offset="1" stopColor={first.dark} />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={SHIELD} />
        </clipPath>
      </defs>
      <path d={SHIELD} fill={field} />
      <g clipPath={`url(#${id}-clip)`}>
        {spec.division === 'pale' && <rect x="50" y="0" width="50" height="100" fill={second.dark} opacity="0.85" />}
        {spec.division === 'bend' && <path d="M0 0 L100 100 L100 0 Z" fill={second.dark} opacity="0.7" />}
        {spec.division === 'chevron' && <path d="M0 78 L50 46 L100 78 L100 100 L0 100 Z" fill={second.dark} opacity="0.75" />}
        {spec.division === 'chief' && <rect x="0" y="0" width="100" height="26" fill={second.dark} opacity="0.85" />}
        <circle cx="50" cy="52" r="27" fill="none" stroke="rgb(0 0 0 / 0.35)" strokeWidth="2" strokeDasharray="3 5" transform={`rotate(${spec.turn} 50 52)`} />
      </g>
      <path d={sigilPath(spec.sigil)} fill="rgb(12 16 14 / 0.82)" stroke="rgb(246 242 232 / 0.55)" strokeWidth="1.2" strokeLinejoin="round" />
      <path d={SHIELD} fill="none" stroke="rgb(246 242 232 / 0.75)" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

/** A stand-in opponent: a painted duelist of their colour on a backdrop in it, framed like a portrait. */
export function Portrait({ name, colors, boss = false, size = 72, label }: { name: string; colors?: string; boss?: boolean; size?: number; label?: string }) {
  const painted = usePaintedArt();
  const drawn = <DrawnPortrait name={name} colors={colors} boss={boss} size={size} label={label} />;
  if (!painted) return drawn;
  const back = ART_COLORS[portraitArt(name, colors)[0]] ?? ART_COLORS.C;
  return (
    <span
      className={[styles.portrait, boss ? styles.portraitBoss : ''].join(' ')}
      style={{ '--size': `${size}px`, '--back-light': back.light, '--back-dark': back.dark } as CSSProperties}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Art kind="portrait" id={portraitArt(name, colors, boss)} size={size} fallback={drawn} />
    </span>
  );
}

function DrawnPortrait({ name, colors, boss = false, size, label }: { name: string; colors?: string; boss?: boolean; size: number; label?: string }) {
  const id = useId().replace(/:/g, '');
  const spec = useMemo(() => portraitSpec(name, colors, boss), [name, colors, boss]);
  const back = ART_COLORS[spec.colors[0]] ?? ART_COLORS.C;
  const cloak = ART_COLORS[spec.colors[1] ?? spec.colors[0]] ?? back;
  const shoulder = 18 + spec.build * 14;
  const eye = spec.glow ? '#ffc65a' : 'rgb(12 16 14 / 0.85)';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <defs>
        <radialGradient id={`${id}-bg`} cx="0.5" cy="0.35" r="0.75">
          <stop offset="0" stopColor={back.light} stopOpacity="0.9" />
          <stop offset="1" stopColor={back.dark} />
        </radialGradient>
        <clipPath id={`${id}-frame`}>
          <rect x="2" y="2" width="96" height="96" rx="16" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-frame)`}>
        <rect x="0" y="0" width="100" height="100" fill={`url(#${id}-bg)`} />
        {/* shoulders and cloak */}
        <path d={`M${50 - shoulder - 14} 100 C${50 - shoulder - 10} 76 ${50 - shoulder} 70 50 70 C${50 + shoulder} 70 ${50 + shoulder + 10} 76 ${50 + shoulder + 14} 100 Z`} fill={cloak.dark} />
        <path d="M40 72 L50 88 L60 72" fill="none" stroke={cloak.light} strokeWidth="2.5" opacity="0.8" />
        {/* head */}
        {spec.headwear === 'hood' && <path d="M26 74 C24 40 34 20 50 20 C66 20 76 40 74 74 Z" fill={cloak.dark} />}
        <ellipse cx="50" cy="48" rx="15" ry="18" fill={spec.headwear === 'hood' ? 'rgb(12 16 14 / 0.85)' : spec.tone} />
        <ellipse cx="44" cy="47" rx="2.6" ry={spec.glow ? 2.2 : 1.8} fill={eye} />
        <ellipse cx="56" cy="47" rx="2.6" ry={spec.glow ? 2.2 : 1.8} fill={eye} />
        {spec.headwear === 'hood' && (
          <>
            <ellipse cx="44" cy="48" rx="2" ry="1.6" fill={back.light} opacity="0.8" />
            <ellipse cx="56" cy="48" rx="2" ry="1.6" fill={back.light} opacity="0.8" />
          </>
        )}
        {spec.headwear === 'crown' && <path d="M35 34 L36 22 L42 29 L50 18 L58 29 L64 22 L65 34 Z" fill="#d6b36a" stroke="rgb(12 16 14 / 0.6)" strokeWidth="1" />}
        {spec.headwear === 'horns' && (
          <>
            <path d="M37 36 C28 30 26 20 30 12 C32 22 36 26 42 30 Z" fill="#e9e4d6" opacity="0.9" />
            <path d="M63 36 C72 30 74 20 70 12 C68 22 64 26 58 30 Z" fill="#e9e4d6" opacity="0.9" />
          </>
        )}
        {spec.headwear === 'helm' && <path d="M34 46 C34 28 42 26 50 26 C58 26 66 28 66 46 L60 46 L60 40 L40 40 L40 46 Z" fill="#8c8a82" stroke="rgb(12 16 14 / 0.6)" strokeWidth="1" />}
        {spec.headwear === 'circlet' && <path d="M35 37 C42 33 58 33 65 37" fill="none" stroke={cloak.light} strokeWidth="2.5" />}
        {spec.headwear === 'bare' && <path d="M35 42 C35 28 44 27 50 27 C56 27 65 28 65 42 C60 34 40 34 35 42 Z" fill="rgb(12 16 14 / 0.7)" />}
      </g>
      <rect x="2" y="2" width="96" height="96" rx="16" fill="none" stroke={boss ? '#d6b36a' : 'rgb(246 242 232 / 0.5)'} strokeWidth={boss ? 4 : 2.5} />
    </svg>
  );
}
