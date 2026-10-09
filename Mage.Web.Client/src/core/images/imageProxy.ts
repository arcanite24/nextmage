/**
 * Routes Scryfall traffic through the deployment's caching proxy (ops/web imgcache, served under /img by Caddy).
 *
 * Links are stored as Scryfall gives them (IndexedDB keeps the raw CDN links) and rewritten only when used, so
 * cached links keep working whether or not a build has a proxy.
 */

const SCRYFALL_ORIGINS: readonly (readonly [origin: string, path: string])[] = [
  ['https://api.scryfall.com/', 'api/'],
  ['https://cards.scryfall.io/', 'cards/'],
];

/** The proxy prefix of this build (VITE_IMAGE_PROXY, e.g. "/img"), or undefined to talk to Scryfall directly. */
export function configuredImageProxy(): string | undefined {
  const value = (import.meta.env.VITE_IMAGE_PROXY as string | undefined)?.trim();
  return value ? value : undefined;
}

/**
 * The link to use for a Scryfall API or CDN link: `${proxy}/api/...` or `${proxy}/cards/...` when a proxy is set,
 * the link itself otherwise. Links to anything else (and malformed ones) come back unchanged.
 */
export function proxiedScryfallUrl(url: string, proxy: string | undefined): string {
  if (!proxy) return url;
  const base = proxy.replace(/\/+$/, '');
  for (const [origin, path] of SCRYFALL_ORIGINS) {
    if (url.startsWith(origin)) return `${base}/${path}${url.slice(origin.length)}`;
  }
  return url;
}
