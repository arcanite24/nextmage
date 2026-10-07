import { describe, expect, test, vi } from 'vitest';
import { ImageResolver, type ImageLinkStore, type PrintingImages } from './ImageResolver';
import { normalizeCollectorNumber, printingKey } from './imageLinks';

function memoryStore(initial: Record<string, PrintingImages> = {}): ImageLinkStore & { data: Map<string, PrintingImages> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: async (key) => data.get(key),
    setMany: async (entries) => {
      entries.forEach(([key, value]) => data.set(key, value));
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const LINKS = {
  cards: { 'SOI/Tamiyo\'s Journal/265+a': 'https://api.scryfall.com/cards/soi/265†a/' },
  tokens: { 'RIX/Golem': 'https://api.scryfall.com/cards/trix/4/en?format=image' },
};

function createResolver(fetchImpl: typeof fetch, store = memoryStore()) {
  return new ImageResolver({ fetch: fetchImpl, store, batchDelayMs: 1, minRequestIntervalMs: 0 });
}

describe('ImageResolver', () => {
  test('looks printings up in one batch and serves faces and sizes', async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith('scryfall-links.json')) return jsonResponse(LINKS);
      const body = JSON.parse(String(init?.body));
      expect(body.identifiers).toEqual([
        { set: 'm10', collector_number: '146' },
        { set: 'isd', collector_number: '51' },
      ]);
      return jsonResponse({
        data: [
          { set: 'm10', collector_number: '146', image_uris: { normal: 'bolt-normal', art_crop: 'bolt-art' } },
          { set: 'isd', collector_number: '51', card_faces: [{ image_uris: { normal: 'front' } }, { image_uris: { normal: 'back' } }] },
        ],
      });
    }) as unknown as typeof fetch;
    const resolver = createResolver(fetchImpl);

    expect(resolver.resolve({ name: 'Lightning Bolt', expansionSetCode: 'M10', cardNumber: '146' })).toBeNull();
    expect(resolver.resolve({ name: 'Delver of Secrets', expansionSetCode: 'ISD', cardNumber: '51' })).toBeNull();
    await vi.waitFor(() => expect(resolver.getVersion()).toBeGreaterThan(1));

    expect(resolver.resolve({ name: 'Lightning Bolt', expansionSetCode: 'M10', cardNumber: '146' }, 'front', 'art_crop')).toBe('bolt-art');
    expect(resolver.resolve({ name: 'Delver of Secrets', expansionSetCode: 'ISD', cardNumber: '51' }, 'back')).toBe('back');
    const collectionCalls = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .filter(([url]) => String(url).includes('/cards/collection'));
    expect(collectionCalls).toHaveLength(1);
  });

  test('uses exported links for tokens and special printings', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(LINKS)) as unknown as typeof fetch;
    const resolver = createResolver(fetchImpl);
    resolver.resolve({ name: 'x' });
    await vi.waitFor(() => expect(resolver.getVersion()).toBeGreaterThan(0));

    expect(resolver.resolve({ name: 'Golem', expansionSetCode: 'RIX', isToken: true }, 'front', 'large'))
      .toBe('https://api.scryfall.com/cards/trix/4/en?format=image&version=large');
    expect(resolver.resolve({ name: 'Unknown Token', expansionSetCode: 'RIX', isToken: true })).toBeUndefined();
  });

  test('falls back to a name lookup when Scryfall does not know a printing', async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith('scryfall-links.json')) return jsonResponse(LINKS);
      return jsonResponse({ data: [], not_found: [{}] });
    }) as unknown as typeof fetch;
    const resolver = createResolver(fetchImpl);
    resolver.resolve({ name: 'Custom Card', expansionSetCode: 'CUS', cardNumber: '1' });
    await vi.waitFor(() => expect(resolver.getVersion()).toBeGreaterThan(1));
    expect(resolver.resolve({ name: 'Custom Card', expansionSetCode: 'CUS', cardNumber: '1' }))
      .toContain('https://api.scryfall.com/cards/named?exact=Custom+Card');
  });

  test('reads the persistent cache before the network', async () => {
    const store = memoryStore({ 'm10/146': { front: { normal: 'cached' }, fetchedAt: Date.now() } });
    const fetchImpl = vi.fn(async () => jsonResponse(LINKS)) as unknown as typeof fetch;
    const resolver = createResolver(fetchImpl, store);
    resolver.resolve({ name: 'Lightning Bolt', expansionSetCode: 'M10', cardNumber: '146' });
    await vi.waitFor(() => expect(resolver.resolve({ name: 'Lightning Bolt', expansionSetCode: 'M10', cardNumber: '146' })).toBe('cached'));
    const collectionCalls = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .filter(([url]) => String(url).includes('/cards/collection'));
    expect(collectionCalls).toHaveLength(0);
  });

  test('normalizes XMage collector numbers', () => {
    expect(normalizeCollectorNumber('123*')).toBe('123');
    expect(printingKey({ expansionSetCode: 'M10', cardNumber: '146' })).toBe('m10/146');
    expect(printingKey({ expansionSetCode: '', cardNumber: '1' })).toBeNull();
  });
});
