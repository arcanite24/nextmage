import { siteForHost, type DeckSiteId } from './sites';

export type Recognized =
  | { kind: 'site'; site: DeckSiteId; remoteId: string; url: string }
  | { kind: 'unknownUrl'; url: string }
  | { kind: 'list'; text: string }
  | { kind: 'empty' };

const TRACKING = /^(utm_|fbclid$|gclid$|mc_|ref$|ref_src$|si$|igshid$)/i;
const DECK_DOCUMENT = /^\s*(<\?xml|<cockatrice_deck|<deck\b|\{)/i;
const CARD_LINE = /^\s*(SB:\s*)?\d+\s*x?\s+\S/i;
const SECTION_LINE = /^\s*(\/\/\s*)?(deck|main ?deck|mainboard|sideboard|commanders?|companion|maybeboard|about)\s*:?\s*(\(\d+\))?\s*$/i;

/** A single link, with or without its scheme ("moxfield.com/decks/…" pasted from an address bar). */
function asUrl(text: string): URL | null {
  if (/\s/.test(text)) return null;
  const withScheme = /^https?:\/\//i.test(text) ? text : /^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(text) ? `https://${text}` : null;
  if (!withScheme) return null;
  try {
    const url = new URL(withScheme);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

/** The link without tracking parameters or the fragment, on https. */
function cleanUrl(url: URL, keep?: string[]): string {
  const clean = new URL(url.toString());
  clean.protocol = 'https:';
  clean.hash = '';
  for (const key of [...clean.searchParams.keys()]) {
    if (keep ? !keep.includes(key) : TRACKING.test(key)) clean.searchParams.delete(key);
  }
  return clean.toString();
}

/**
 * What the player gave us: a deck link (and which site), another link, a deck list, or nothing usable.
 * Pure and instant, so the import sheet can show the site before anything is fetched.
 */
export function recognize(input: string): Recognized {
  const text = input.trim();
  if (!text) return { kind: 'empty' };

  const url = asUrl(text);
  if (url) {
    const site = siteForHost(url.hostname);
    const remoteId = site?.deckId(url);
    if (site && remoteId) return { kind: 'site', site: site.id, remoteId, url: cleanUrl(url, site.keepParams) };
    return { kind: 'unknownUrl', url: cleanUrl(url) };
  }

  if (DECK_DOCUMENT.test(text)) return { kind: 'list', text };
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.some((line) => CARD_LINE.test(line))) return { kind: 'list', text };
  // names without counts still read as a list once there are a few of them, or a section header
  if (lines.length >= 2 && lines.every((line) => !/^https?:\/\//i.test(line))) return { kind: 'list', text };
  if (lines.some((line) => SECTION_LINE.test(line))) return { kind: 'list', text };
  return { kind: 'empty' };
}
