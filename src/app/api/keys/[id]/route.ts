import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/guard";
import { jsonError } from "@/server/http";
import { revokeApiKey } from "@/features/api-keys/service";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(req);
    await revokeApiKey((await ctx.params).id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return jsonError(err);
  }
}
