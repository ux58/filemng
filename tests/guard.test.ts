import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setDbForTests, type AppDb } from "@/server/db";
import { resetSettingsCache } from "@/server/settings/service";
import { hashApiKey } from "@/server/security/api-key";
import { signAccessToken } from "@/server/security/jwt";
import type { NextRequest } from "next/server";

/**
 * 鉴权守卫权限矩阵：
 * | 场景                       | 期望 |
 * | 无凭证访问 v1              | 401  |
 * | Key 缺 scope               | 403  |
 * | Key 有 scope               | 通过 |
 * | requireUser 拒绝 API Key   | 401  |
 * | 过期 Key                   | 401  |
 * | 吊销 Key                   | 401  |
 * | 有效会话 Cookie            | 通过 |
 * | 会话吊销后 Cookie          | 401  |
 * | 白名单 Key + 匹配 Origin   | 通过 |
 * | 白名单 Key + 非白名单来源  | 403  |
 * | 白名单 Key + 无来源(cURL)  | 403  |
 * | 白名单 Key + 子域名 Origin | 通过 |
 */

let db: AppDb;
const REAL_KEY = "fmm_testkey000000000000000000000000000000000";
const now = () => new Date().toISOString();

function fakeReq(opts: { apiKey?: string; cookie?: string; origin?: string; referer?: string }): NextRequest {
  const headers = new Headers();
  if (opts.apiKey) headers.set("x-api-key", opts.apiKey);
  if (opts.origin) headers.set("origin", opts.origin);
  if (opts.referer) headers.set("referer", opts.referer);
  const cookieValue = opts.cookie;
  return {
    headers,
    cookies: { get: (name: string) => (cookieValue && name === "fmm_at" ? { name, value: cookieValue } : undefined) },
  } as unknown as NextRequest;
}

beforeAll(async () => {
  db = drizzle(new Database(":memory:")) as unknown as AppDb;
  await migrate(db, { migrationsFolder: "drizzle" });
  setDbForTests(db);
  resetSettingsCache();

  const { schema } = await import("@/server/db");
  const userId = crypto.randomUUID();
  await db.insert(schema.users).values({ id: userId, username: "u1", passwordHash: "x", createdAt: now(), updatedAt: now() });
  await db.insert(schema.apiKeys).values([
    { id: crypto.randomUUID(), name: "read-only", keyPrefix: "fmm_test", keyHash: hashApiKey(REAL_KEY), scopes: "songs:read", rateLimit: 100, createdAt: now(), updatedAt: now() },
    { id: crypto.randomUUID(), name: "expired", keyPrefix: "fmm_exp", keyHash: hashApiKey("fmm_expired00000000000000000000000000000000"), scopes: "songs:read", rateLimit: 100, expiresAt: "2020-01-01T00:00:00Z", createdAt: now(), updatedAt: now() },
    { id: crypto.randomUUID(), name: "revoked", keyPrefix: "fmm_rev", keyHash: hashApiKey("fmm_revoked000000000000000000000000000000000"), scopes: "songs:read", rateLimit: 100, revokedAt: "2020-01-01T00:00:00Z", createdAt: now(), updatedAt: now() },
    { id: crypto.randomUUID(), name: "whitelisted", keyPrefix: "fmm_wl", keyHash: hashApiKey("fmm_whitelist00000000000000000000000000000000"), scopes: "songs:read", allowedDomains: "good.example.com", rateLimit: 100, createdAt: now(), updatedAt: now() },
  ]);
  // 有效会话
  const sessionId = crypto.randomUUID();
  await db.insert(schema.sessions).values({ id: sessionId, userId, refreshHash: "h", expiresAt: "2099-01-01T00:00:00Z", createdAt: now() });
  globalThis.__testSession = { sessionId, userId };
});

afterAll(() => {
  globalThis.__testSession = undefined;
});

declare global {
    var __testSession: { sessionId: string; userId: string } | undefined;
}

describe("鉴权守卫权限矩阵", () => {
  it("无凭证访问 401", async () => {
    const { requireScope } = await import("@/server/auth/guard");
    await expect(requireScope(fakeReq({}))).rejects.toMatchObject({ status: 401 });
  });

  it("只读 Key 缺 songs:write 时 403", async () => {
    const { requireScope } = await import("@/server/auth/guard");
    await expect(
      requireScope(fakeReq({ apiKey: REAL_KEY }), "songs:write"),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("只读 Key 具备 songs:read 时通过", async () => {
    const { requireScope } = await import("@/server/auth/guard");
    const p = await requireScope(fakeReq({ apiKey: REAL_KEY }), "songs:read");
    expect(p!.kind).toBe("apiKey");
  });

  it("requireUser 拒绝 API Key 通道（管理端点仅限会话）", async () => {
    const { requireUser } = await import("@/server/auth/guard");
    await expect(requireUser(fakeReq({ apiKey: REAL_KEY }))).rejects.toMatchObject({ status: 401 });
  });

  it("过期 Key 401", async () => {
    const { authenticate } = await import("@/server/auth/guard");
    await expect(authenticate(fakeReq({ apiKey: "fmm_expired00000000000000000000000000000000" }))).rejects.toMatchObject({
      status: 401,
    });
  });

  it("吊销 Key 401", async () => {
    const { authenticate } = await import("@/server/auth/guard");
    await expect(authenticate(fakeReq({ apiKey: "fmm_revoked000000000000000000000000000000000" }))).rejects.toMatchObject({
      status: 401,
    });
  });

  it("有效会话 Cookie 通过，且隐含全部 scope", async () => {
    const { requireScope } = await import("@/server/auth/guard");
    const token = await signAccessToken({ sub: globalThis.__testSession!.userId, sid: globalThis.__testSession!.sessionId });
    const p = await requireScope(fakeReq({ cookie: token }), "songs:write");
    expect(p.kind).toBe("user");
  });

  it("会话不存在（伪造 sid）时 Cookie 通道 401", async () => {
    const { requireScope } = await import("@/server/auth/guard");
    const token = await signAccessToken({ sub: globalThis.__testSession!.userId, sid: crypto.randomUUID() });
    await expect(requireScope(fakeReq({ cookie: token }), "songs:read")).rejects.toMatchObject({ status: 401 });
  });

  describe("域名白名单", () => {
    const WL_KEY = "fmm_whitelist00000000000000000000000000000000";

    it("白名单域名的 Origin 通过", async () => {
      const { authenticate } = await import("@/server/auth/guard");
      const p = await authenticate(fakeReq({ apiKey: WL_KEY, origin: "https://good.example.com" }));
      expect(p!.kind).toBe("apiKey");
    });

    it("白名单域名的子域名通过", async () => {
      const { authenticate } = await import("@/server/auth/guard");
      const p = await authenticate(fakeReq({ apiKey: WL_KEY, origin: "https://app.good.example.com" }));
      expect(p!.kind).toBe("apiKey");
    });

    it("非白名单来源 403", async () => {
      const { authenticate } = await import("@/server/auth/guard");
      await expect(
        authenticate(fakeReq({ apiKey: WL_KEY, origin: "https://evil.example.com" })),
      ).rejects.toMatchObject({ status: 403 });
    });

    it("伪装 Referer 后缀（notgood.example.com）不匹配 403", async () => {
      const { authenticate } = await import("@/server/auth/guard");
      await expect(
        authenticate(fakeReq({ apiKey: WL_KEY, referer: "https://notgood.example.com/page" })),
      ).rejects.toMatchObject({ status: 403 });
    });

    it("无来源头（服务端直连）403", async () => {
      const { authenticate } = await import("@/server/auth/guard");
      await expect(authenticate(fakeReq({ apiKey: WL_KEY }))).rejects.toMatchObject({ status: 403 });
    });
  });
});
