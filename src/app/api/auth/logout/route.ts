import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logout } from "@/server/auth/service";
import { clearedCookies } from "@/server/auth/cookies";
import { jsonError } from "@/server/http";

export async function POST(req: NextRequest) {
  try {
    await logout(req.cookies.get("fmm_rt")?.value);
    const res = NextResponse.json({ ok: true });
    for (const c of clearedCookies) res.cookies.set(c);
    return res;
  } catch (err) {
    return jsonError(err);
  }
}
