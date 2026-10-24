import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireScope } from "@/server/auth/guard";
import { jsonError } from "@/server/http";
import { deleteSong, getSong, updateSong, type IncomingFile, type UploadFile } from "@/features/songs/service";
import { songUpdateSchema } from "@/features/songs/schema";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireScope(req, "songs:read");
    return NextResponse.json(await getSong((await ctx.params).id));
  } catch (err) {
    return jsonError(err);
  }
}

/** 更新：JSON（元数据 + 可选 audioUpload/coverUpload 直传引用）或 multipart（payload + 替换文件本体） */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    await requireScope(req, "songs:write");
    const id = (await ctx.params).id;
    const contentType = req.headers.get("content-type") ?? "";
    let patch: unknown;
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
      patch = JSON.parse(payloadRaw);
      files = {
        audio: await toUploadFile(form.get("audio")),
        cover: await toUploadFile(form.get("cover")),
      };
    } else {
      const parsed = songUpdateSchema.parse(await req.json());
      patch = parsed;
      files = {
        audio: parsed.audioUpload ? { refKey: parsed.audioUpload.key, name: parsed.audioUpload.name } : undefined,
        cover: parsed.coverUpload ? { refKey: parsed.coverUpload.key, name: parsed.coverUpload.name } : undefined,
      };
    }
    const song = await updateSong(id, songUpdateSchema.parse(patch), files);
    return NextResponse.json(song);
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    await requireScope(req, "songs:write");
    await deleteSong((await ctx.params).id);
    return new NextResponse(null, { status: 204 });
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
