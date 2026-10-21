import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/guard";
import { jsonError } from "@/server/http";
import { createApiKey, listApiKeys } from "@/features/api-keys/service";
import { apiKeyCreateSchema } from "@/features/api-keys/schema";

export async function GET(req: NextRequest) {
  try {
    await requireUser(req);
    return NextResponse.json({ items: await listApiKeys() });
  } catch (err) {
    return jsonError(err);
  }
}

/** 创建 API Key：明文仅此响应返回一次 */
export async function POST(req: NextRequest) {
  try {
    await requireUser(req);
    const input = apiKeyCreateSchema.parse(await req.json());
    const { dto, key } = await createApiKey(input);
    return NextResponse.json({ ...dto, key }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
