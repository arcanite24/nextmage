/**
 * How a player shows up: a sigil (the server keeps it as an avatar id) and a flag (the server keeps the desktop
 * client's flag file name, "de.png"). Avatar ids are bounded by the server (10 to 32); 10 is the default, shown as
 * the player's initial, and 11 is reserved for the server's own staff avatars.
 */
export const DEFAULT_AVATAR_ID = 10;

export const SIGILS: { id: number; glyph: string; label: string }[] = [
  { id: 12, glyph: '🐉', label: 'Dragon' },
  { id: 13, glyph: '🦉', label: 'Owl' },
  { id: 14, glyph: '🐺', label: 'Wolf' },
  { id: 15, glyph: '🦊', label: 'Fox' },
  { id: 16, glyph: '🐍', label: 'Serpent' },
  { id: 17, glyph: '🦁', label: 'Lion' },
  { id: 18, glyph: '🐻', label: 'Bear' },
  { id: 19, glyph: '🦅', label: 'Eagle' },
  { id: 20, glyph: '🐙', label: 'Kraken' },
  { id: 21, glyph: '🦂', label: 'Scorpion' },
  { id: 22, glyph: '🕷️', label: 'Spider' },
  { id: 23, glyph: '🐢', label: 'Turtle' },
  { id: 24, glyph: '🦄', label: 'Unicorn' },
  { id: 25, glyph: '🔥', label: 'Flame' },
  { id: 26, glyph: '❄️', label: 'Frost' },
  { id: 27, glyph: '⚡', label: 'Lightning' },
  { id: 28, glyph: '🌙', label: 'Moon' },
  { id: 29, glyph: '☀️', label: 'Sun' },
  { id: 30, glyph: '🌿', label: 'Leaf' },
  { id: 31, glyph: '💀', label: 'Skull' },
  { id: 32, glyph: '🗡️', label: 'Blade' },
];

const SIGIL_BY_ID = new Map(SIGILS.map((sigil) => [sigil.id, sigil]));

/** The sigil glyph for an avatar id, or null for the default (and desktop avatars, which have no web artwork). */
export function sigilOf(avatarId: number | null | undefined): string | null {
  return avatarId ? SIGIL_BY_ID.get(avatarId)?.glyph ?? null : null;
}

const COUNTRIES = 'ad ae af ag ai al am ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bm bn bo bq br bs bt bw by bz ca cc cd cf cg ch ci ck cl cm cn co cr cu cv cx cy cz de dj dk dm do dz ec ee eg eh er es et fi fj fk fm fo fr ga gb gd ge gf gh gi gl gm gn gp gq gr gs gt gu gw gy hk hn hr ht hu id ie il in io iq ir is it jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pe pf pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh si sk sl sm sn so sr st sv sy sz tc td tf tg th tj tk tl tm tn to tr tt tv tw tz ua ug us uy uz va vc ve vg vi vn vu wf ws ye yt za zm zw'.split(' ');

const SPECIAL: Record<string, { glyph: string; label: string }> = {
  world: { glyph: '🌐', label: 'Anywhere' },
  europeanunion: { glyph: '🇪🇺', label: 'European Union' },
  england: { glyph: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', label: 'England' },
  scotland: { glyph: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', label: 'Scotland' },
  wales: { glyph: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', label: 'Wales' },
  lgbt: { glyph: '🏳️‍🌈', label: 'Pride' },
  trans: { glyph: '🏳️‍⚧️', label: 'Trans pride' },
};

/** The flag code from the server's file name ("de.png" -> "de"). */
export function flagCode(flagName: string | null | undefined): string {
  return (flagName ?? '').replace(/\.png$/i, '').toLowerCase() || 'world';
}

/** An emoji for a flag code: regional indicators for countries, a globe for anything unknown. */
export function flagGlyph(code: string): string {
  const special = SPECIAL[code];
  if (special) return special.glyph;
  if (/^[a-z]{2}$/.test(code)) {
    return String.fromCodePoint(...[...code.toUpperCase()].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
  }
  return SPECIAL.world.glyph;
}

let regionNames: Intl.DisplayNames | null | undefined;

export function flagLabel(code: string): string {
  const special = SPECIAL[code];
  if (special) return special.label;
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(undefined, { type: 'region' });
    } catch {
      regionNames = null;
    }
  }
  try {
    return regionNames?.of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

/** Every flag a player can pick, the specials first, then countries by name. */
export function flagChoices(): { code: string; label: string; glyph: string }[] {
  const specials = Object.keys(SPECIAL).map((code) => ({ code, label: flagLabel(code), glyph: flagGlyph(code) }));
  const countries = COUNTRIES.map((code) => ({ code, label: flagLabel(code), glyph: flagGlyph(code) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return [...specials, ...countries];
}
