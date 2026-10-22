import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { ApiError } from "@/server/http";
import { hashApiKey, hashEquals } from "@/server/security/api-key";
import { verifyAccessToken } from "@/server/security/jwt";
import * as rateLimit from "@/server/security/rate-limit";
import { resolveSession } from "@/server/auth/service";
import { COOKIE_ACCESS, ERROR_CODES, SCOPES, type Scope } from "@/shared/constants";

export type Principal =
  | { kind: "user"; userId: string; username: string }
  | { kind: "apiKey"; keyId: string; name: string; scopes: Set<string> };

/** 双通道鉴权：X-API-Key（外部调用，scope 受限）或 会话 Cookie（管理 UI，隐含全部权限） */
export async function authenticate(req: NextRequest): Promise<Principal | null> {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) return authenticateApiKey(apiKey, req);
  const token = req.cookies.get(COOKIE_ACCESS)?.value;
  if (!token) return null;
  const claims = await verifyAccessToken(token);
  if (!claims) return null;
  const user = await resolveSession(claims.sub, claims.sid);
  return user ? { kind: "user", userId: user.id, username: user.username } : null;
}

export async function requireScope(req: NextRequest, scope?: (typeof SCOPES)[number]): Promise<Principal> {
  const principal = await authenticate(req);
  if (!principal) throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, "未认证：请携带 X-API-Key 或先登录");
  if (scope && principal.kind === "apiKey" && !principal.scopes.has(scope)) {
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, `缺少 ${scope} 权限`);
  }
  return principal;
}

/** 页面/服务端组件用：无效或未登录返回 null（不抛错，便于 redirect） */
export async function requireUser(req: NextRequest): Promise<Principal & { kind: "user" }> {
  const principal = await authenticate(req);
  if (!principal || principal.kind !== "user") throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, "请先登录");
  return principal;
}

const lastUsedAt = new Map<string, string>(); // keyId → 上次落库时间，节流避免每请求写库

async function authenticateApiKey(key: string, req: NextRequest): Promise<Principal> {
  const db = await getDb();
  const rows = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.keyHash, hashApiKey(key))).limit(1);
  const record = rows[0];
  const unauthorized = new ApiError(401, ERROR_CODES.UNAUTHORIZED, "无效的 API Key");
  if (!record || !hashEquals(hashApiKey(key), record.keyHash)) throw unauthorized;
  const now = new Date().toISOString();
  if (record.revokedAt) throw unauthorized;
  if (record.expiresAt && record.expiresAt < now) {
    throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, "API Key 已过期");
  }
  // 域名白名单：配置后仅允许白名单域名的浏览器端调用（依据 Origin/Referer；无来源头视为越权）
  if (record.allowedDomains) {
    const allowed = record.allowedDomains.split(",").filter(Boolean);
    const referer = req.headers.get("referer");
    const originSource = req.headers.get("origin") ?? (referer ? referer : null);
    let hostname: string | null = null;
    if (originSource) {
      try {
        hostname = new URL(originSource).hostname;
      } catch {
        hostname = null;
      }
    }
    const permitted = hostname !== null && allowed.some((d) => hostname === d || hostname.endsWith("." + d));
    if (!permitted) {
      throw new ApiError(403, ERROR_CODES.FORBIDDEN, "该 API Key 已绑定域名白名单，当前来源不被允许");
    }
  }
  const rl = rateLimit.consume(`key:${record.id}`, record.rateLimit);
  if (!rl.ok) {
    throw new ApiError(429, ERROR_CODES.RATE_LIMITED, "请求过于频繁", {
      "Retry-After": String(rl.retryAfterSec),
      "X-RateLimit-Remaining": "0",
    });
  }
  if (lastUsedAt.get(record.id) !== now.slice(0, 16)) {
    lastUsedAt.set(record.id, now.slice(0, 16));
    await db.update(schema.apiKeys).set({ lastUsedAt: now }).where(eq(schema.apiKeys.id, record.id));
  }
  return { kind: "apiKey", keyId: record.id, name: record.name, scopes: new Set(record.scopes.split(",")) };
}

export type { Scope };
