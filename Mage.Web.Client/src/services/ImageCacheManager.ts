/**
 * Image Cache Manager
 * 
 * Handles persistent caching of card images using IndexedDB.
 * Supports LRU eviction, size limits, and cache statistics.
 */

export interface CacheEntry {
  key: string;
  url: string;
  blob: Blob;
  size: number;
  timestamp: number;
  lastAccessed: number;
  accessCount: number;
}

export interface CacheStats {
  entryCount: number;
  totalSize: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
}

const DB_NAME = 'mage-image-cache';
const DB_VERSION = 1;
const STORE_NAME = 'images';
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB default

export class ImageCacheManager {
  private db: IDBDatabase | null = null;
  private ready: Promise<void>;
  private stats = {
    hitCount: 0,
    missCount: 0,
  };

  constructor() {
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[ImageCache] Failed to open database', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[ImageCache] Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store with keyPath and indexes
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
          store.createIndex('size', 'size', { unique: false });
          console.log('[ImageCache] Object store created');
        }
      };
    });
  }

  async get(key: string): Promise<Blob | null> {
    await this.ready;

    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined;
        if (entry) {
          // Update access stats
          this.stats.hitCount++;
          entry.lastAccessed = Date.now();
          entry.accessCount++;

          // Update the entry with new access time
          const updateRequest = store.put(entry);
          updateRequest.onsuccess = () => {
            console.log(`[ImageCache] Cache hit: ${key}`);
            resolve(entry.blob);
          };
          updateRequest.onerror = () => {
            console.error(`[ImageCache] Failed to update entry: ${key}`);
            reject(updateRequest.error);
          };
        } else {
          this.stats.missCount++;
          console.log(`[ImageCache] Cache miss: ${key}`);
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error(`[ImageCache] Failed to get entry: ${key}`, request.error);
        reject(request.error);
      };
    });
  }

  async put(key: string, url: string, blob: Blob): Promise<void> {
    await this.ready;

    if (!this.db) return;

    const entry: CacheEntry = {
      key,
      url,
      blob,
      size: blob.size,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
    };

    // Check cache size and evict if necessary
    await this.evictIfNeeded(blob.size);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);

      request.onsuccess = () => {
        console.log(`[ImageCache] Cached: ${key} (${this.formatSize(blob.size)})`);
        resolve();
      };

      request.onerror = () => {
        console.error(`[ImageCache] Failed to cache: ${key}`, request.error);
        reject(request.error);
      };
    });
  }

  async evictIfNeeded(newSize: number): Promise<void> {
    const stats = await this.getStats();

    if (stats.totalSize + newSize <= MAX_CACHE_SIZE) {
      return; // No eviction needed
    }

    console.log('[ImageCache] Cache size limit reached, evicting old entries...');

    // Evict entries by LRU (least recently used)
    await this.evictByLRU(MAX_CACHE_SIZE - newSize);
  }

  private async evictByLRU(targetSize: number): Promise<void> {
    await this.ready;

    if (!this.db) return;

    // Get all entries first to calculate size
    const allEntries = await this.getAllEntries();
    const sortedEntries = allEntries
      .sort((a, b) => a.lastAccessed - b.lastAccessed);

    let currentSize = sortedEntries.reduce((sum, entry) => sum + entry.size, 0);
    const entriesToDelete: string[] = [];

    // Mark entries to delete
    for (const entry of sortedEntries) {
      if (currentSize <= targetSize) break;

      entriesToDelete.push(entry.key);
      currentSize -= entry.size;
    }

    // Now delete the entries
    if (entriesToDelete.length > 0) {
      for (const key of entriesToDelete) {
        await this.delete(key);
      }
      console.log(`[ImageCache] Evicted ${entriesToDelete.length} entries`);
    }
  }

  private async getCurrentSize(): Promise<number> {
    await this.ready;

    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = request.result as CacheEntry[];
        const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
        resolve(totalSize);
      };

      request.onerror = () => {
        console.error('[ImageCache] Failed to calculate size', request.error);
        reject(request.error);
      };
    });
  }

  async delete(key: string): Promise<void> {
    await this.ready;

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => {
        console.log(`[ImageCache] Deleted: ${key}`);
        resolve();
      };

      request.onerror = () => {
        console.error(`[ImageCache] Failed to delete: ${key}`, request.error);
        reject(request.error);
      };
    });
  }

  async clear(): Promise<void> {
    await this.ready;

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[ImageCache] Cache cleared');
        this.stats.hitCount = 0;
        this.stats.missCount = 0;
        resolve();
      };

      request.onerror = () => {
        console.error('[ImageCache] Failed to clear cache', request.error);
        reject(request.error);
      };
    });
  }

  async getStats(): Promise<CacheStats> {
    await this.ready;

    if (!this.db) {
      return {
        entryCount: 0,
        totalSize: 0,
        hitCount: this.stats.hitCount,
        missCount: this.stats.missCount,
        hitRate: 0,
      };
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = request.result as CacheEntry[];
        const entryCount = entries.length;
        const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
        const totalRequests = this.stats.hitCount + this.stats.missCount;
        const hitRate = totalRequests > 0 ? (this.stats.hitCount / totalRequests) * 100 : 0;

        resolve({
          entryCount,
          totalSize,
          hitCount: this.stats.hitCount,
          missCount: this.stats.missCount,
          hitRate,
        });
      };

      request.onerror = () => {
        console.error('[ImageCache] Failed to get stats', request.error);
        reject(request.error);
      };
    });
  }

  async getAllEntries(): Promise<CacheEntry[]> {
    await this.ready;

    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result as CacheEntry[]);
      };

      request.onerror = () => {
        console.error('[ImageCache] Failed to get entries', request.error);
        reject(request.error);
      };
    });
  }

  async deleteOldEntries(maxAgeMs: number): Promise<number> {
    const entries = await this.getAllEntries();
    const cutoffTime = Date.now() - maxAgeMs;
    let deletedCount = 0;

    for (const entry of entries) {
      if (entry.timestamp < cutoffTime) {
        await this.delete(entry.key);
        deletedCount++;
      }
    }

    console.log(`[ImageCache] Deleted ${deletedCount} entries older than ${maxAgeMs / (1000 * 60 * 60 * 24)} days`);
    return deletedCount;
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}

export const imageCacheManager = new ImageCacheManager();
