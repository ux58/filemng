import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireScope } from "@/server/auth/guard";
import { jsonError } from "@/server/http";
import { createSong, listSongs, type UploadFile } from "@/features/songs/service";
import { songCreateSchema, songQuerySchema } from "@/features/songs/schema";

export async function GET(req: NextRequest) {
  try {
    await requireScope(req, "songs:read");
    const result = await listSongs(songQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams)));
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}

/**
 * 创建歌曲：multipart/form-data
 * - payload: JSON 字符串（SongCreateInput）
 * - audio: 音频文件（可选）；cover: 封面图片（可选）
 */
export async function POST(req: NextRequest) {
  try {
    await requireScope(req, "songs:write");
    const form = await req.formData();
    const payloadRaw = form.get("payload");
    if (typeof payloadRaw !== "string") {
      return NextResponse.json(
        { error: { code: "validation_error", message: "缺少 payload 字段（JSON 字符串）" } },
        { status: 422 },
      );
    }
    const input = songCreateSchema.parse(JSON.parse(payloadRaw));
    const audio = await toUploadFile(form.get("audio"));
    const cover = await toUploadFile(form.get("cover"));
    const song = await createSong(input, { audio, cover });
    return NextResponse.json(song, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

async function toUploadFile(value: FormDataEntryValue | null): Promise<UploadFile | undefined> {
  if (!value || typeof value === "string") return undefined;
  const file = value as File;
  if (file.size === 0) return undefined;
  return { buffer: Buffer.from(await file.arrayBuffer()), originalName: file.name.slice(0, 200) };
}
