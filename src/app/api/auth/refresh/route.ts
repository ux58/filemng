import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { refreshSession } from "@/server/auth/service";
import { accessCookie, refreshCookie } from "@/server/auth/cookies";
import { jsonError } from "@/server/http";
import { COOKIE_REFRESH, ERROR_CODES } from "@/shared/constants";

/** 刷新令牌轮换：携带旧 refresh cookie 换取新对，旧令牌立即作废 */
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_REFRESH)?.value;
    if (!token) {
      return NextResponse.json(
        { error: { code: ERROR_CODES.UNAUTHORIZED, message: "缺少刷新令牌" } },
        { status: 401 },
      );
    }
    const tokens = await refreshSession(token);
    const res = NextResponse.json({ user: tokens.user });
    res.cookies.set(accessCookie(tokens.accessToken));
    res.cookies.set(refreshCookie(tokens.refreshToken));
    return res;
  } catch (err) {
    return jsonError(err);
  }
}
