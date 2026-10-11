import { beforeEach, describe, expect, test, vi } from 'vitest';

const calls: { method: string; args: unknown }[] = [];

/** Like Capacitor's plugin object: every property is a native method, `then` included, and unknown ones reject. */
function fakePlugin() {
  const methods: Record<string, (args: unknown) => Promise<unknown>> = {
    prefetch: async () => undefined,
    stats: async () => ({ files: 3, bytes: 4096 }),
    clear: async () => undefined,
  };
  return new Proxy({}, {
    get(_target, name: string) {
      return (args: unknown) => {
        calls.push({ method: name, args });
        return methods[name]?.(args) ?? Promise.reject(new Error(`"PictureCache.${name}()" is not implemented on android`));
      };
    },
  });
}

beforeEach(() => {
  calls.length = 0;
  vi.resetModules();
  vi.doMock('./brand', () => ({ NATIVE_APP: true }));
  vi.doMock('@capacitor/core', () => ({ registerPlugin: () => fakePlugin() }));
});

describe('the device picture store', () => {
  test('answers through the plugin without treating it as a promise', async () => {
    const { pictureStoreStats, clearPictureStore } = await import('./nativePictures');
    await expect(pictureStoreStats()).resolves.toEqual({ files: 3, bytes: 4096 });
    await expect(clearPictureStore()).resolves.toBeUndefined();
    expect(calls.map((call) => call.method)).toEqual(['stats', 'clear']);
  });

  test('batches links and sends each one once', async () => {
    vi.useFakeTimers();
    const { storePictures } = await import('./nativePictures');
    storePictures(['https://site/img/cards/a.jpg', 'https://site/img/cards/b.jpg']);
    storePictures(['https://site/img/cards/a.jpg']);
    await vi.advanceTimersByTimeAsync(150);
    storePictures(['https://site/img/cards/a.jpg', 'https://site/img/cards/c.jpg']);
    await vi.advanceTimersByTimeAsync(150);
    vi.useRealTimers();
    expect(calls).toEqual([
      { method: 'prefetch', args: { urls: ['https://site/img/cards/a.jpg', 'https://site/img/cards/b.jpg'] } },
      { method: 'prefetch', args: { urls: ['https://site/img/cards/c.jpg'] } },
    ]);
  });
});
