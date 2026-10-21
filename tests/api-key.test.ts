import { describe, expect, it } from "vitest";
import { generateApiKey, hashApiKey, hashEquals } from "@/server/security/api-key";
import * as rateLimit from "@/server/security/rate-limit";

describe("api-key", () => {
  it("生成 fmm_ 前缀 Key，哈希稳定且不可逆推", () => {
    const { key, prefix, hash } = generateApiKey();
    expect(key).toMatch(/^fmm_[A-Za-z0-9]{43}$/);
    expect(prefix).toBe(key.slice(0, 10));
    expect(hash).toBe(hashApiKey(key));
    expect(hash).not.toContain(key);
  });

  it("同输入同哈希，timingSafeEqual 包装正确判等", () => {
    expect(hashEquals(hashApiKey("k"), hashApiKey("k"))).toBe(true);
    expect(hashEquals(hashApiKey("k"), hashApiKey("j"))).toBe(false);
  });
});

describe("rate-limit（令牌桶）", () => {
  it("限额内放行，超限 429 语义并给出重试时间", () => {
    const id = `t-${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(rateLimit.consume(id, 3).ok).toBe(true);
    const blocked = rateLimit.consume(id, 3);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("时间推进后按速率补充令牌", () => {
    const id = `t-${Math.random()}`;
    for (let i = 0; i < 60; i++) rateLimit.consume(id, 60, 0); // 耗尽满桶（60/min）
    expect(rateLimit.consume(id, 60, 0).ok).toBe(false);
    expect(rateLimit.consume(id, 60, 1000).ok).toBe(true); // 1s 补充 1 个
    expect(rateLimit.consume(id, 60, 1400).ok).toBe(false); // 仅补充 0.4 个
  });
});
