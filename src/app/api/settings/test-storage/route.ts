import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/guard";
import { jsonError } from "@/server/http";
import { getStorage } from "@/server/storage";

/** 存储连接测试：local 校验根目录可写，s3 校验 bucket 可达 */
export async function POST(req: NextRequest) {
  try {
    await requireUser(req);
    await (await getStorage()).test();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
