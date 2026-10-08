/**
 * The deck websites Playmat recognizes. One row per site: which hosts it lives on, how to read the deck id
 * from a link, and how the deck reaches us.
 *
 * Tier "direct": the server fetches and reads the deck (DeckImportApi). Tier "assisted": the site blocks
 * automated fetches, so we open its export view and finish when the player pastes the list.
 * The server keeps its own copy of the direct sites' hosts; keep both in step.
 */

export type DeckSiteId =
  | 'archidekt' | 'tcgplayer' | 'mtgtop8' | 'scryfall' | 'manabox'
  | 'moxfield' | 'mtggoldfish' | 'aetherhub' | 'tappedout' | 'deckstats';

export type DeckSiteTier = 'direct' | 'assisted';

export interface DeckSite {
  id: DeckSiteId;
  name: string;
  /** two letters printed on the site chip; our own mark, never the site's logo */
  monogram: string;
  tier: DeckSiteTier;
  hosts: string[];
  /** reads the deck id from a parsed link, or null when the link isn't a deck page */
  deckId(url: URL): string | null;
  /** query parameters that belong to the deck link; everything else is dropped */
  keepParams?: string[];
  /** where the export lives, for the assisted flow (defaults to the deck page itself) */
  exportUrl?(deckUrl: URL, id: string): string;
  /** one sentence, in the site's own words, on getting the list out */
  exportHint: string;
}

const segment = (url: URL, pattern: RegExp) => pattern.exec(url.pathname)?.[1] ?? null;

export const DECK_SITES: DeckSite[] = [
  {
    id: 'archidekt',
    name: 'Archidekt',
    monogram: 'Ar',
    tier: 'direct',
    hosts: ['archidekt.com', 'www.archidekt.com'],
    deckId: (url) => segment(url, /^\/(?:api\/)?decks\/(\d+)(?:[/?#]|$)/),
    exportHint: 'Open the deck, choose Export, then Copy to clipboard.',
  },
  {
    id: 'tcgplayer',
    name: 'TCGplayer',
    monogram: 'Tc',
    tier: 'direct',
    hosts: ['infinite.tcgplayer.com', 'www.tcgplayer.com', 'tcgplayer.com'],
    deckId: (url) => segment(url, /^\/(?:content\/)?magic-the-gathering\/deck\/[^/]+\/(\d+)\/?$/),
    exportHint: 'Open the deck, choose Copy Deck List, then MTG Arena.',
  },
  {
    id: 'mtgtop8',
    name: 'MTGTop8',
    monogram: 'T8',
    tier: 'direct',
    hosts: ['mtgtop8.com', 'www.mtgtop8.com'],
    deckId: (url) => (/^\/(event|dec|mtgo)$/.test(url.pathname) ? (/^\d+$/.exec(url.searchParams.get('d') ?? '')?.[0] ?? null) : null),
    keepParams: ['e', 'd', 'f'],
    exportUrl: (_url, id) => `https://mtgtop8.com/mtgo?d=${id}`,
    exportHint: 'The MTGO export opens as plain text: select it all and copy.',
  },
  {
    id: 'scryfall',
    name: 'Scryfall',
    monogram: 'Sf',
    tier: 'direct',
    hosts: ['scryfall.com', 'www.scryfall.com', 'api.scryfall.com'],
    deckId: (url) => segment(url, /^\/(?:@[^/]+\/)?decks\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i),
    exportHint: 'Open the deck, choose Export, then Copy as text.',
  },
  {
    id: 'manabox',
    name: 'ManaBox',
    monogram: 'Mb',
    tier: 'direct',
    hosts: ['manabox.app', 'www.manabox.app'],
    deckId: (url) => segment(url, /^\/decks\/([A-Za-z0-9_-]{22})\/?$/),
    exportHint: 'In the app, open the deck, choose Share, then Copy as text.',
  },
  {
    id: 'moxfield',
    name: 'Moxfield',
    monogram: 'Mx',
    tier: 'assisted',
    hosts: ['moxfield.com', 'www.moxfield.com'],
    deckId: (url) => segment(url, /^\/decks\/([A-Za-z0-9_-]{6,})\/?$/),
    exportHint: 'On the deck, open More, choose Export, then Copy for MTG Arena.',
  },
  {
    id: 'mtggoldfish',
    name: 'MTGGoldfish',
    monogram: 'Gf',
    tier: 'assisted',
    hosts: ['mtggoldfish.com', 'www.mtggoldfish.com'],
    deckId: (url) => segment(url, /^\/deck\/(?:arena_download\/|download\/)?(\d+)\/?$/),
    exportUrl: (_url, id) => `https://www.mtggoldfish.com/deck/${id}`,
    exportHint: 'Press Copy for Arena under the deck list.',
  },
  {
    id: 'aetherhub',
    name: 'AetherHub',
    monogram: 'Ah',
    tier: 'assisted',
    hosts: ['aetherhub.com', 'www.aetherhub.com'],
    deckId: (url) => segment(url, /^\/(?:Metagame\/[^/]+\/)?Deck\/(?:Public\/|MtgoDeck\/)?([A-Za-z0-9-]+)\/?$/i),
    exportHint: 'Press Export, then Copy to MTGA.',
  },
  {
    id: 'tappedout',
    name: 'TappedOut',
    monogram: 'To',
    tier: 'assisted',
    hosts: ['tappedout.net', 'www.tappedout.net', 'm.tappedout.net'],
    deckId: (url) => segment(url, /^\/mtg-decks\/([a-z0-9-]+)\/?$/i),
    exportUrl: (url) => `https://tappedout.net${url.pathname.replace(/\/?$/, '/')}?fmt=txt`,
    exportHint: 'The list opens as plain text: select it all and copy.',
  },
  {
    id: 'deckstats',
    name: 'Deckstats',
    monogram: 'Ds',
    tier: 'assisted',
    hosts: ['deckstats.net', 'www.deckstats.net'],
    deckId: (url) => {
      const match = /^\/decks\/(\d+)\/(\d+)[^/]*(?:\/[a-z]{2})?\/?$/.exec(url.pathname);
      return match ? `${match[1]}/${match[2]}` : null;
    },
    exportUrl: (url) => `https://deckstats.net${url.pathname.replace(/\/[a-z]{2}\/?$/, '')}?export_mtgarena=1&include_comments=0`,
    exportHint: 'The Arena export opens as plain text: select it all and copy.',
  },
];

const BY_HOST = new Map(DECK_SITES.flatMap((site) => site.hosts.map((host) => [host, site] as const)));
const BY_ID = new Map(DECK_SITES.map((site) => [site.id, site] as const));

export function siteForHost(host: string): DeckSite | undefined {
  return BY_HOST.get(host.toLowerCase());
}

export function siteById(id: DeckSiteId | string | undefined): DeckSite | undefined {
  return id ? BY_ID.get(id as DeckSiteId) : undefined;
}

/** Where to send the player to copy the list from this deck link. */
export function exportLinkFor(site: DeckSite, url: string, id: string): string {
  try {
    const parsed = new URL(url);
    return site.exportUrl ? site.exportUrl(parsed, id) : parsed.toString();
  } catch {
    return url;
  }
}

/** A readable deck name from a link's slug ("mono-red-aggro-1012345" → "Mono Red Aggro"). */
export function nameFromLink(url: string): string | undefined {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    // a slug reads as words; ids mix capitals and digits ("E3zZUHuCBUiC2dExO6wn4A")
    const slug = [...parts].reverse().find((part) => /[a-z]/i.test(part)
      && !(/[A-Z]/.test(part) && /\d/.test(part))
      && !/^(decks?|mtg-decks|deck|public|en|api|export|json)$/i.test(part)
      && !/^@/.test(part));
    if (!slug) return undefined;
    const words = slug.replace(/[-_]+/g, ' ').replace(/\b\d{3,}\b/g, '').replace(/^\d+\s*/, '').trim();
    return words ? words.replace(/\b\w/g, (letter) => letter.toUpperCase()) : undefined;
  } catch {
    return undefined;
  }
}
