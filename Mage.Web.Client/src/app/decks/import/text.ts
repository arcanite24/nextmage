const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
/** the paste shortcut as this player's keyboard writes it */
export const PASTE_KEYS = IS_MAC ? '⌘V' : 'Ctrl+V';

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31_536_000_000], ['month', 2_592_000_000], ['week', 604_800_000], ['day', 86_400_000], ['hour', 3_600_000], ['minute', 60_000]];
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "3 days ago", "yesterday", "just now". */
export function timeAgo(at: number, now = Date.now()): string {
  const elapsed = now - at;
  for (const [unit, size] of UNITS) {
    if (Math.abs(elapsed) >= size) return relative.format(-Math.round(elapsed / size), unit);
  }
  return 'just now';
}

