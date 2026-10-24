import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireScope } from "@/server/auth/guard";
import { jsonError } from "@/server/http";
import { getStorage } from "@/server/storage";

/** 当前存储后端形态：前端据此选择 multipart 或预签名直传 */
export async function GET(req: NextRequest) {
  try {
    await requireScope(req, "songs:read");
    const storage = await getStorage();
    return NextResponse.json({ driver: storage.driver, directUpload: Boolean(storage.presignPut) });
  } catch (err) {
    return jsonError(err);
  }
}
