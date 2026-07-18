interface CacheEntry<T> {
  savedAt: number;
  data: T;
}

const CACHE_PREFIX = "soccer-stats:";

function storageKey(key: string) {
  return `${CACHE_PREFIX}${key}`;
}

export function readPersistentCache<T>(key: string): CacheEntry<T> | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePersistentCache<T>(key: string, data: T) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      storageKey(key),
      JSON.stringify({ savedAt: Date.now(), data }),
    );
  } catch {
    // Cache writes are best effort; storage can be unavailable or full.
  }
}

export function updatePersistentCacheEntries(
  predicate: (key: string) => boolean,
  updater: (data: unknown, key: string) => unknown,
) {
  if (typeof window === "undefined") return;

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const storageEntryKey = window.localStorage.key(index);
      if (!storageEntryKey?.startsWith(CACHE_PREFIX)) continue;

      const key = storageEntryKey.slice(CACHE_PREFIX.length);
      if (!predicate(key)) continue;

      const raw = window.localStorage.getItem(storageEntryKey);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as CacheEntry<unknown>;
      if (!parsed || typeof parsed.savedAt !== "number") continue;

      window.localStorage.setItem(
        storageEntryKey,
        JSON.stringify({
          savedAt: Date.now(),
          data: updater(parsed.data, key),
        }),
      );
    }
  } catch {
    // Cache updates are best effort; stale entries will be replaced on refetch.
  }
}
