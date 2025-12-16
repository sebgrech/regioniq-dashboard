type Key = string

// Simple in-memory cache + inflight dedupe.
// - Client-only (Mapbox + Supabase anon usage is client-side here anyway)
// - No invalidation: keys are immutable per session (level/metric/year/scenario).
const cache = new Map<Key, unknown>()
const inflight = new Map<Key, Promise<unknown>>()

export function getCacheKey(parts: Array<string | number>) {
  return parts.join("|")
}

export function getCached<T>(key: Key): T | undefined {
  return cache.get(key) as T | undefined
}

export function setCached<T>(key: Key, value: T) {
  cache.set(key, value)
}

export async function getOrFetch<T>(key: Key, fetcher: () => Promise<T>): Promise<T> {
  const hit = getCached<T>(key)
  if (hit !== undefined) return hit

  const existing = inflight.get(key)
  if (existing) return (await existing) as T

  const p = (async () => {
    const v = await fetcher()
    setCached(key, v)
    return v
  })()
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, p)
  return (await p) as T
}


