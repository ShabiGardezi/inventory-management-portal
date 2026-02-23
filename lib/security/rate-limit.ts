type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const GLOBAL_KEY = '__lead_rate_limit__';

function getStore(): Map<string, RateLimitRecord> {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map<string, RateLimitRecord>();
  }
  return g[GLOBAL_KEY] as Map<string, RateLimitRecord>;
}

export function checkRateLimit({
  key,
  limit,
  windowMs,
  now = Date.now(),
}: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const store = getStore();
  const cur = store.get(key);
  if (!cur || cur.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (cur.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)) };
  }

  store.set(key, { ...cur, count: cur.count + 1 });
  return { ok: true };
}

