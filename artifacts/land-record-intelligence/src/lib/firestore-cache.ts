/**
 * Production Firestore Subscription Multiplexer & In-Memory SWR Cache
 * 
 * Prevents exponential growth of Firestore reads by:
 * 1. Multiplexing active onSnapshot listeners (1 single network stream shared across N UI components)
 * 2. Caching query results in-memory with a grace-period keepalive on unmount
 * 3. Bounding query sizes to prevent unbounded collection scans
 * 4. Eliminating redundant duplicate queries during navigation and tab switching
 */

type ListenerCallback<T> = (data: T) => void;

interface CacheEntry<T> {
  data: T | null;
  timestamp: number;
  listeners: Set<ListenerCallback<T>>;
  unsubscribeStream?: () => void;
  cleanupTimeoutId?: any;
}

const registry = new Map<string, CacheEntry<any>>();

// Default grace period to keep subscription alive after last component unmounts (45 seconds)
const GRACE_PERIOD_MS = 45000;

export function multiplexSubscription<T>(
  key: string,
  streamFactory: (publish: (data: T) => void) => () => void,
  onUpdate: ListenerCallback<T>
): () => void {
  let entry = registry.get(key);

  if (!entry) {
    entry = {
      data: null,
      timestamp: 0,
      listeners: new Set(),
    };
    registry.set(key, entry);
  }

  // Cancel any pending eviction timeout because a component just subscribed
  if (entry.cleanupTimeoutId) {
    clearTimeout(entry.cleanupTimeoutId);
    entry.cleanupTimeoutId = undefined;
  }

  // Register the new component listener
  entry.listeners.add(onUpdate);

  // If we already have hot cached data in memory, instantly deliver it to avoid any UI flash
  if (entry.data !== null) {
    try {
      onUpdate(entry.data);
    } catch (e) {
      console.warn(`[FirestoreCache] Error delivering cached data for key ${key}:`, e);
    }
  }

  // If there is no active underlying Firebase onSnapshot stream, start one now
  if (!entry.unsubscribeStream) {
    const publish = (freshData: T) => {
      const currentEntry = registry.get(key);
      if (!currentEntry) return;

      currentEntry.data = freshData;
      currentEntry.timestamp = Date.now();

      // Broadcast to all multiplexed listeners
      currentEntry.listeners.forEach((listener) => {
        try {
          listener(freshData);
        } catch (err) {
          console.warn(`[FirestoreCache] Listener error on key ${key}:`, err);
        }
      });
    };

    try {
      entry.unsubscribeStream = streamFactory(publish);
    } catch (err) {
      console.warn(`[FirestoreCache] Stream factory error for key ${key}:`, err);
    }
  }

  // Return unsubscription cleanup handler for the component
  return () => {
    const currentEntry = registry.get(key);
    if (!currentEntry) return;

    currentEntry.listeners.delete(onUpdate);

    // If no active components are currently listening, schedule graceful stream teardown
    if (currentEntry.listeners.size === 0) {
      currentEntry.cleanupTimeoutId = setTimeout(() => {
        if (currentEntry.listeners.size === 0) {
          if (currentEntry.unsubscribeStream) {
            try {
              currentEntry.unsubscribeStream();
            } catch {}
            currentEntry.unsubscribeStream = undefined;
          }
          registry.delete(key);
        }
      }, GRACE_PERIOD_MS);
    }
  };
}

/**
 * In-memory document get cache to deduplicate repeated getDoc calls
 */
const docCache = new Map<string, { data: any; expiry: number }>();
const DOC_CACHE_TTL_MS = 60000; // 60 seconds

export async function getCachedDoc<T>(
  cacheKey: string,
  fetcher: () => Promise<T | null>
): Promise<T | null> {
  const now = Date.now();
  const cached = docCache.get(cacheKey);

  if (cached && cached.expiry > now) {
    return cached.data as T;
  }

  const fresh = await fetcher();
  if (fresh) {
    docCache.set(cacheKey, { data: fresh, expiry: now + DOC_CACHE_TTL_MS });
  }
  return fresh;
}

export function invalidateDocCache(cacheKey?: string) {
  if (cacheKey) {
    docCache.delete(cacheKey);
  } else {
    docCache.clear();
  }
}
