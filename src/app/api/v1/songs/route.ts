import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireScope } from "@/server/auth/guard";
import { jsonError } from "@/server/http";
import { createSong, listSongs, type IncomingFile, type UploadFile } from "@/features/songs/service";
import { songCreateSchema, songMultipartPayloadSchema, songQuerySchema } from "@/features/songs/schema";

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
 * 创建歌曲，双通道：
 * - multipart/form-data：payload JSON + audio/cover 文件本体（本地存储与小文件场景）
 * - application/json：携带 audioUpload/coverUpload 直传引用（先经 upload-url 端点 PUT，Serverless 场景）
 */
export async function POST(req: NextRequest) {
  try {
    await requireScope(req, "songs:write");
    const contentType = req.headers.get("content-type") ?? "";
    let input: ReturnType<typeof songCreateSchema.parse>;
    let files: { audio?: IncomingFile; cover?: IncomingFile } = {};
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const payloadRaw = form.get("payload");
      if (typeof payloadRaw !== "string") {
        return NextResponse.json(
          { error: { code: "validation_error", message: "缺少 payload 字段（JSON 字符串）" } },
          { status: 422 },
        );
      }
      input = songMultipartPayloadSchema.parse(JSON.parse(payloadRaw));
      files = {
        audio: await toUploadFile(form.get("audio")),
        cover: await toUploadFile(form.get("cover")),
      };
    } else {
      const body = await req.json();
      input = songCreateSchema.parse(body);
      files = toUploadedRefs(input);
    }
    const song = await createSong(input, files);
    return NextResponse.json(song, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

/** Schema 直传字段 → 服务层 IncomingFile */
function toUploadedRefs(input: { audioUpload?: { key: string; name: string }; coverUpload?: { key: string; name: string } }) {
  return {
    audio: input.audioUpload ? { refKey: input.audioUpload.key, name: input.audioUpload.name } : undefined,
    cover: input.coverUpload ? { refKey: input.coverUpload.key, name: input.coverUpload.name } : undefined,
  };
}

async function toUploadFile(value: FormDataEntryValue | null): Promise<UploadFile | undefined> {
  if (!value || typeof value === "string") return undefined;
  const file = value as File;
  if (file.size === 0) return undefined;
  return { buffer: Buffer.from(await file.arrayBuffer()), originalName: file.name.slice(0, 200) };
}
