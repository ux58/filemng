/**
 * 进程内存令牌桶限流（单实例部署；多实例部署时可替换为 Redis 实现，接口不变）。
 */
interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

/** @returns 允许通过则 true；同时返回剩余配额与重试等待秒数 */
export function consume(
  id: string,
  limitPerMin: number,
  now = Date.now(),
): { ok: boolean; remaining: number; retryAfterSec: number } {
  sweep(now);
  const refillPerMs = limitPerMin / 60_000;
  const b = buckets.get(id) ?? { tokens: limitPerMin, lastRefill: now };
  b.tokens = Math.min(limitPerMin, b.tokens + (now - b.lastRefill) * refillPerMs);
  b.lastRefill = now;
  if (b.tokens < 1) {
    buckets.set(id, b);
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((1 - b.tokens) / refillPerMs / 1000) };
  }
  b.tokens -= 1;
  buckets.set(id, b);
  return { ok: true, remaining: Math.floor(b.tokens), retryAfterSec: 0 };
}

export function reset(id: string): void {
  buckets.delete(id);
}

/** 周期清扫闲置桶，防内存泄漏 */
function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [id, b] of buckets) {
    if (now - b.lastRefill > 10 * 60_000) buckets.delete(id);
  }
}
