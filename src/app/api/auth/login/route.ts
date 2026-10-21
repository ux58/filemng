import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { login } from "@/server/auth/service";
import { accessCookie, refreshCookie } from "@/server/auth/cookies";
import { jsonError } from "@/server/http";
import * as rateLimit from "@/server/security/rate-limit";

const bodySchema = z.strictObject({ username: z.string().trim().min(1).max(50), password: z.string().min(1).max(72) });

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.parse(await req.json());
    // 登录限流：IP + 用户名 双维度，10 次/分钟
    for (const id of [`login:ip:${clientIp(req)}`, `login:u:${body.username}`]) {
      const rl = rateLimit.consume(id, 10);
      if (!rl.ok) {
        return NextResponse.json(
          { error: { code: "rate_limited", message: "尝试过于频繁，请稍后再试" } },
          { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
        );
      }
    }
    const tokens = await login(body.username, body.password, req.headers.get("user-agent") ?? "", clientIp(req));
    const res = NextResponse.json({ user: tokens.user });
    res.cookies.set(accessCookie(tokens.accessToken));
    res.cookies.set(refreshCookie(tokens.refreshToken));
    return res;
  } catch (err) {
    return jsonError(err);
  }
}
