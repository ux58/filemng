import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/guard";
import { jsonError } from "@/server/http";
import { getSettings, updateSettings } from "@/server/settings/service";

export async function GET(req: NextRequest) {
  try {
    await requireUser(req);
    return NextResponse.json(await getSettings());
  } catch (err) {
    return jsonError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireUser(req);
    return NextResponse.json(await updateSettings(await req.json()));
  } catch (err) {
    return jsonError(err);
  }
}
