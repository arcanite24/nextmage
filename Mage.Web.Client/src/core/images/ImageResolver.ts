import {
  exceptionLink,
  namedImageLink,
  printingKey,
  setCodeOf,
  normalizeCollectorNumber,
  toImageLink,
  type CardFace,
  type CardImageRef,
  type ImageSize,
  type ScryfallLinks,
} from './imageLinks';

type ImageUris = Partial<Record<ImageSize, string>>;

/** Image links of one printing, as returned by Scryfall. */
export interface PrintingImages {
  front?: ImageUris;
  back?: ImageUris;
  notFound?: boolean;
  fetchedAt: number;
}

/** Persistent cache of printing links (IndexedDB in browsers, memory in tests). */
export interface ImageLinkStore {
  get(key: string): Promise<PrintingImages | undefined>;
  setMany(entries: [string, PrintingImages][]): Promise<void>;
}

export interface ImageResolverOptions {
  fetch?: typeof fetch;
  store?: ImageLinkStore;
  linksUrl?: string;
  /** Scryfall asks clients to stay under 10 requests per second */
  minRequestIntervalMs?: number;
  batchDelayMs?: number;
  /** cached links older than this are refreshed */
  maxAgeMs?: number;
  now?: () => number;
}

interface ScryfallCard {
  set?: string;
  collector_number?: string;
  image_uris?: ImageUris;
  card_faces?: { image_uris?: ImageUris }[];
}

const MAX_BATCH = 75; // Scryfall /cards/collection limit
const DAY = 24 * 60 * 60 * 1000;

/**
 * Resolves card pictures to Scryfall CDN links.
 *
 * Printings are looked up in batches of up to 75 with POST /cards/collection, rate limited, and the links are
 * cached persistently. The browser's HTTP cache then keeps the image files themselves, so nothing is
 * downloaded twice and a full board costs one or two API requests instead of one per card.
 */
export class ImageResolver {
  private readonly options: Required<Omit<ImageResolverOptions, 'store'>> & { store: ImageLinkStore | null };
  private readonly memory = new Map<string, PrintingImages>();
  private readonly inFlight = new Set<string>();
  private readonly queue: { key: string; set: string; number: string }[] = [];
  private readonly listeners = new Set<() => void>();
  private links: ScryfallLinks | null = null;
  private linksPromise: Promise<void> | null = null;
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private draining = false;
  private lastRequestAt = 0;
  private version = 0;

  constructor(options: ImageResolverOptions = {}) {
    this.options = {
      fetch: options.fetch ?? ((...args) => fetch(...args)),
      store: options.store ?? null,
      linksUrl: options.linksUrl ?? '/data/scryfall-links.json',
      minRequestIntervalMs: options.minRequestIntervalMs ?? 120,
      batchDelayMs: options.batchDelayMs ?? 40,
      maxAgeMs: options.maxAgeMs ?? 30 * DAY,
      now: options.now ?? (() => Date.now()),
    };
  }

  /** Changes whenever new links arrive (for useSyncExternalStore). */
  getVersion(): number {
    return this.version;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * The best known image link, or null while it is being looked up (call again after the next notification).
   * Returns undefined when the card has no known picture at all, so the UI can draw a text frame instead.
   */
  resolve(card: CardImageRef, face: CardFace = 'front', size: ImageSize = 'normal'): string | null | undefined {
    this.ensureLinks();
    const exception = exceptionLink(card, face, this.links);
    if (exception) return toImageLink(exception, size);
    if (card.isToken) {
      // tokens without a mapped picture have no reliable Scryfall printing
      return this.links ? undefined : null;
    }

    const key = printingKey(card);
    if (!key) return card.name ? namedImageLink(card, face, size) : undefined;

    const cached = this.memory.get(key);
    if (cached && !this.isStale(cached)) {
      if (cached.notFound) return namedImageLink(card, face, size);
      const uris = face === 'back' ? cached.back ?? cached.front : cached.front;
      return uris?.[size] ?? uris?.normal ?? uris?.large ?? namedImageLink(card, face, size);
    }

    this.request(key, setCodeOf(card), normalizeCollectorNumber(card.cardNumber));
    return null;
  }

  /** Look up many cards ahead of time (deck lists, a new board). */
  prefetch(cards: Iterable<CardImageRef>): void {
    this.ensureLinks();
    for (const card of cards) {
      if (card.isToken) continue;
      const key = printingKey(card);
      if (key && !this.memory.has(key)) this.request(key, setCodeOf(card), normalizeCollectorNumber(card.cardNumber));
    }
  }

  private isStale(entry: PrintingImages): boolean {
    return this.options.now() - entry.fetchedAt > this.options.maxAgeMs;
  }

  private ensureLinks(): void {
    if (this.links || this.linksPromise) return;
    this.linksPromise = this.options.fetch(this.options.linksUrl)
      .then((response) => (response.ok ? response.json() : null))
      .then((links: ScryfallLinks | null) => {
        this.links = links ?? { cards: {}, tokens: {} };
        this.notify();
      })
      .catch(() => {
        this.links = { cards: {}, tokens: {} };
        this.notify();
      });
  }

  private request(key: string, set: string, number: string): void {
    if (this.inFlight.has(key)) return;
    this.inFlight.add(key);
    const store = this.options.store;
    const enqueue = () => {
      this.queue.push({ key, set, number });
      this.scheduleBatch();
    };
    if (!store) {
      enqueue();
      return;
    }
    store.get(key).then((stored) => {
      if (stored && !this.isStale(stored)) {
        this.memory.set(key, stored);
        this.inFlight.delete(key);
        this.notify();
      } else {
        enqueue();
      }
    }, enqueue);
  }

  private scheduleBatch(): void {
    if (this.batchTimer || this.draining) return;
    this.batchTimer = setTimeout(() => {
      this.batchTimer = null;
      void this.drain();
    }, this.options.batchDelayMs);
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, MAX_BATCH);
        const wait = this.lastRequestAt + this.options.minRequestIntervalMs - this.options.now();
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        this.lastRequestAt = this.options.now();
        await this.fetchBatch(batch);
      }
    } finally {
      this.draining = false;
      if (this.queue.length > 0) this.scheduleBatch();
    }
  }

  private async fetchBatch(batch: { key: string; set: string; number: string }[], attempt = 0): Promise<void> {
    let response: Response;
    try {
      response = await this.options.fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          identifiers: batch.map((item) => ({ set: item.set.toLowerCase(), collector_number: item.number })),
        }),
      });
    } catch {
      this.giveUp(batch);
      return;
    }

    if (response.status === 429 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      await this.fetchBatch(batch, attempt + 1);
      return;
    }
    if (!response.ok) {
      this.giveUp(batch);
      return;
    }

    const body = await response.json() as { data?: ScryfallCard[] };
    const now = this.options.now();
    const found = new Map<string, PrintingImages>();
    for (const card of body.data ?? []) {
      const key = `${(card.set ?? '').toLowerCase()}/${(card.collector_number ?? '').toLowerCase()}`;
      const faces = card.card_faces ?? [];
      found.set(key, {
        front: card.image_uris ?? faces[0]?.image_uris,
        back: card.image_uris ? undefined : faces[1]?.image_uris,
        fetchedAt: now,
      });
    }

    const entries: [string, PrintingImages][] = batch.map((item) => [
      item.key,
      found.get(item.key) ?? { notFound: true, fetchedAt: now },
    ]);
    for (const [key, entry] of entries) {
      this.memory.set(key, entry);
      this.inFlight.delete(key);
    }
    this.options.store?.setMany(entries).catch(() => undefined);
    this.notify();
  }

  /** Network trouble: fall back to direct links for this session, retry on the next visit. */
  private giveUp(batch: { key: string }[]): void {
    for (const item of batch) {
      this.memory.set(item.key, { notFound: true, fetchedAt: this.options.now() - this.options.maxAgeMs + 60_000 });
      this.inFlight.delete(item.key);
    }
    this.notify();
  }

  private notify(): void {
    this.version++;
    this.listeners.forEach((listener) => listener());
  }
}
