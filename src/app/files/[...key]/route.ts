import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getStorageForKey, parseStoredKey, type StorageRange } from "@/server/storage";
import { jsonError } from "@/server/http";

type Ctx = { params: Promise<{ key: string[] }> };

/**
 * 文件读取：键为 128-bit 随机十六进制（不可枚举）+ driver 前缀白名单；
 * 支持 Range 请求（音频拖动/边下边播），输出合规 206 + Content-Range。
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const storedKey = (await ctx.params).key.join("/");
    const parsed = parseStoredKey(storedKey);
    const adapter = parsed ? await getStorageForKey(storedKey) : null;
    if (!parsed || !adapter) return new NextResponse(null, { status: 404 });

    const range = parseRangeHeader(req.headers.get("range"));
    const obj = await adapter.get(parsed.path, range ?? undefined); // 适配器只认剥离前缀后的路径
    if (!obj) return new NextResponse(null, { status: 404 });

    const headers: Record<string, string> = {
      "Content-Type": mimeOf(storedKey),
      "Content-Length": String(obj.size),
      "Cache-Control": "private, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
    };
    let status = 200;
    if (range && obj.total) {
      status = 206;
      headers["Content-Range"] = `bytes ${range.start}-${range.start + obj.size - 1}/${obj.total}`;
    }
    return new NextResponse(obj.stream, { status, headers });
  } catch (err) {
    return jsonError(err);
  }
}

function parseRangeHeader(header: string | null): StorageRange | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  if (m[1] === "") return null; // 后缀区间（bytes=-N）不常用，退化为全量
  const start = Number(m[1]);
  // 开放区间 end 由适配器按对象实际大小截断
  return { start, end: m[2] === "" ? Number.MAX_SAFE_INTEGER : Number(m[2]) };
}

function mimeOf(key: string): string {
  const ext = key.split(".").pop() ?? "";
  const map: Record<string, string> = {
    mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav", flac: "audio/flac", m4a: "audio/mp4",
    jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif",
  };
  return map[ext] ?? "application/octet-stream";
}
