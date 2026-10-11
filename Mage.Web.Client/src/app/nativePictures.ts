import { NATIVE_APP } from './brand';

/**
 * The Android app's picture store (android/.../PictureCache.java): card pictures kept on the device for good and
 * shared with the WebView, which is answered from it before the network. On the web every call here is a no-op, and
 * the bundler drops the Capacitor import (NATIVE_APP is a build constant).
 */
interface PictureCachePlugin {
  prefetch(options: { urls: string[] }): Promise<void>;
  stats(): Promise<{ files: number; bytes: number }>;
  clear(): Promise<void>;
}

/**
 * The plugin, boxed: Capacitor's plugin object answers every property as a native method, `then` included, so a
 * promise resolved with it would call PictureCache.then() on the device and reject.
 */
let plugin: Promise<{ cache: PictureCachePlugin }> | null = null;

/** Runs `call` with the plugin; the plugin itself never resolves a promise (see above). */
async function withPictureCache<T>(call: (cache: PictureCachePlugin) => Promise<T>): Promise<T> {
  plugin ??= import('@capacitor/core').then(({ registerPlugin }) => ({ cache: registerPlugin<PictureCachePlugin>('PictureCache') }));
  const { cache } = await plugin;
  return call(cache);
}

const queued = new Set<string>();
/** links already handed over this session: the store skips stored ones itself, this saves the trip */
const sent = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Whether pictures can be stored on the device (the Android app). */
export const DEVICE_PICTURES = NATIVE_APP;

/** Downloads these picture links to the device in the background, a batch at a time. */
export function storePictures(urls: Iterable<string>): void {
  if (!NATIVE_APP) return;
  for (const url of urls) if (!sent.has(url)) queued.add(url);
  if (queued.size === 0 || flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const batch = [...queued];
    queued.clear();
    for (const url of batch) sent.add(url);
    void withPictureCache((cache) => cache.prefetch({ urls: batch })).catch(() => undefined);
  }, 100);
}

export async function pictureStoreStats(): Promise<{ files: number; bytes: number } | null> {
  if (!NATIVE_APP) return null;
  return withPictureCache((cache) => cache.stats());
}

export async function clearPictureStore(): Promise<void> {
  if (!NATIVE_APP) return;
  sent.clear();
  await withPictureCache((cache) => cache.clear());
}
