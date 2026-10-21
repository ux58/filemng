import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasAnyUser, setupAdmin } from "@/server/auth/service";
import { accessCookie, refreshCookie } from "@/server/auth/cookies";
import { jsonError } from "@/server/http";
import { ERROR_CODES } from "@/shared/constants";

const bodySchema = z.strictObject({
  username: z.string().trim().min(3).max(50).regex(/^[\w.-]+$/, "仅允许字母数字与 . _ -"),
  password: z.string().min(8).max(72),
});

export async function GET() {
  return NextResponse.json({ initialized: await hasAnyUser() });
}

export async function POST(req: NextRequest) {
  try {
    if (await hasAnyUser()) {
      return NextResponse.json(
        { error: { code: ERROR_CODES.CONFLICT, message: "管理员已初始化，请直接登录" } },
        { status: 409 },
      );
    }
    const { username, password } = bodySchema.parse(await req.json());
    const tokens = await setupAdmin(username, password);
    const res = NextResponse.json({ user: tokens.user }, { status: 201 });
    res.cookies.set(accessCookie(tokens.accessToken));
    res.cookies.set(refreshCookie(tokens.refreshToken));
    return res;
  } catch (err) {
    return jsonError(err);
  }
}
