import { SignJWT, jwtVerify } from "jose";
import { ACCESS_TOKEN_TTL_SEC } from "@/shared/constants";
import { env } from "@/server/env";

/** 惰性编码密钥：避免模块求值期触发生产环境 JWT_SECRET 校验（构建期会收集路由） */
let cachedSecret: Uint8Array | null = null;
function secret(): Uint8Array {
  cachedSecret ??= new TextEncoder().encode(env.JWT_SECRET);
  return cachedSecret;
}

export interface AccessClaims {
  sub: string; // userId
  sid: string; // sessionId
}

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ sid: claims.sid, typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SEC}s`)
    .sign(secret());
}

/** 仅做密码学校验（Proxy 乐观检查用）；会话吊销状态由 requireUser 查库确认 */
export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.typ !== "access" || !payload.sub || !payload.sid) return null;
    return { sub: payload.sub, sid: payload.sid as string };
  } catch {
    return null;
  }
}
