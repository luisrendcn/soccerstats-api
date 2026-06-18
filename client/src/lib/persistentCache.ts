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
