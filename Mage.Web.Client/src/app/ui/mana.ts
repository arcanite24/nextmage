/** Mana symbol helpers for XMage cost strings. */
export function parseSymbols(cost: string | string[] | undefined): string[] {
  if (!cost) return [];
  const text = Array.isArray(cost) ? cost.join('') : cost;
  return [...text.matchAll(/\{([^}]+)\}/g)].map((match) => match[1].toUpperCase());
}

/** Mana font class suffix for one symbol, e.g. "W/U" -> "wu", "2/W" -> "2w", "T" -> "tap". */
export function manaClass(symbol: string): string {
  const normalized = symbol.replace(/\//g, '').toLowerCase();
  if (normalized === 't') return 'tap';
  if (normalized === 'q') return 'untap';
  if (normalized === '∞') return 'infinity';
  return normalized;
}
