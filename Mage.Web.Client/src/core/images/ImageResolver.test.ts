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

  describe('notifications', () => {
    const BOLT = { name: 'Lightning Bolt', expansionSetCode: 'M10', cardNumber: '146' };
    const DELVER = { name: 'Delver of Secrets', expansionSetCode: 'ISD', cardNumber: '51' };
    const GOLEM = { name: 'Golem', expansionSetCode: 'RIX', isToken: true };

    function deferredLinks() {
      let release: () => void = () => undefined;
      const linksReady = new Promise<void>((resolve) => { release = resolve; });
      return { linksReady, release: () => release() };
    }

    test('only the subscribers of a printing hear about its links', async () => {
      const { linksReady, release } = deferredLinks();
      // Bolt comes from the persistent cache, Delver from the network
      const store = memoryStore({ 'm10/146': { front: { normal: 'cached-bolt' }, fetchedAt: Date.now() } });
      const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
        if (String(url).endsWith('scryfall-links.json')) {
          await linksReady;
          return jsonResponse(LINKS);
        }
        return jsonResponse({ data: [{ set: 'isd', collector_number: '51', image_uris: { normal: 'delver' } }] });
      }) as unknown as typeof fetch;
      const resolver = createResolver(fetchImpl, store);
      const bolt = vi.fn();
      const delver = vi.fn();
      const token = vi.fn();
      const any = vi.fn();
      resolver.subscribeCard(BOLT, bolt);
      resolver.subscribeCard(DELVER, delver);
      resolver.subscribeCard(GOLEM, token);
      resolver.subscribe(any);

      resolver.resolve(BOLT);
      resolver.resolve(DELVER);
      await vi.waitFor(() => expect(resolver.resolve(BOLT)).toBe('cached-bolt'));
      await vi.waitFor(() => expect(resolver.resolve(DELVER)).toBe('delver'));
      expect(bolt).toHaveBeenCalledTimes(1);
      expect(delver).toHaveBeenCalledTimes(1);
      expect(token).not.toHaveBeenCalled();
      expect(any).toHaveBeenCalledTimes(2);

      // the exported link lists can change any card (exceptions, tokens): everyone hears about them once
      release();
      await vi.waitFor(() => expect(token).toHaveBeenCalledTimes(1));
      expect(bolt).toHaveBeenCalledTimes(2);
      expect(delver).toHaveBeenCalledTimes(2);
      expect(any).toHaveBeenCalledTimes(3);
    });

    test('a listener subscribed to several channels is called once per change', async () => {
      const fetchImpl = vi.fn(async () => jsonResponse(LINKS)) as unknown as typeof fetch;
      const resolver = createResolver(fetchImpl);
      const listener = vi.fn();
      resolver.subscribeKey('m10/146', listener);
      resolver.subscribeKey(null, listener);
      resolver.subscribe(listener);
      resolver.resolve(GOLEM);
      await vi.waitFor(() => expect(listener).toHaveBeenCalled());
      await Promise.resolve();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    test('unsubscribing stops notifications and failed lookups still notify their printing', async () => {
      const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
        if (String(url).endsWith('scryfall-links.json')) return jsonResponse(LINKS);
        throw new Error('offline');
      }) as unknown as typeof fetch;
      const resolver = createResolver(fetchImpl);
      const gone = vi.fn();
      const delver = vi.fn();
      const unsubscribe = resolver.subscribeCard(BOLT, gone);
      unsubscribe();
      resolver.subscribeCard(DELVER, delver);
      resolver.resolve(BOLT);
      resolver.resolve(DELVER);
      await vi.waitFor(() => expect(resolver.resolve(DELVER)).toContain('cards/named'));
      expect(gone).not.toHaveBeenCalled();
      expect(delver).toHaveBeenCalled();
    });
  });
});
