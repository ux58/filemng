import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessToken } from "@/server/security/jwt";
import { COOKIE_ACCESS } from "@/shared/constants";

/**
 * Proxy（原 Middleware）乐观检查：仅做 JWT 密码学校验（不查库）。
 * 完整会话校验（吊销/过期）在 requireUser/requireScope 中以数据库为准。
 */

const PROTECTED = ["/songs", "/keys", "/settings", "/docs"];
const PUBLIC_ONLY = ["/login", "/setup"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const claims = await verifyAccessToken(req.cookies.get(COOKIE_ACCESS)?.value ?? "");

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/")) && !claims) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (PUBLIC_ONLY.includes(pathname) && claims) {
    const url = req.nextUrl.clone();
    url.pathname = "/songs";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|files|_next/static|_next/image|favicon.ico).*)"],
};
