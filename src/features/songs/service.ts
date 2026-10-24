import { randomBytes } from "node:crypto";
import { and, count, desc, eq, like, or, type SQL } from "drizzle-orm";
import { parseBuffer } from "music-metadata";
import { getDb, schema, type Song } from "@/server/db";
import { ApiError } from "@/server/http";
import { getSettings } from "@/server/settings/service";
import { composeKey, getStorage, getStorageForKey, parseStoredKey } from "@/server/storage";
import { sniffMime } from "@/server/security/magic-bytes";
import { AUDIO_MIMES, ERROR_CODES, IMAGE_MIMES } from "@/shared/constants";
import type { SongCreateInput, SongQuery, SongUpdateInput } from "./schema";

export interface UploadFile {
  buffer: Buffer;
  originalName: string;
}

/** 直传引用：客户端已通过预签名 URL 上传到存储后端的对象 */
export interface UploadedRef {
  refKey: string; // 复合键（s3:path）
  name: string;
}

export type IncomingFile = UploadFile | UploadedRef;

export function isUploadedRef(f: IncomingFile): f is UploadedRef {
  return "refKey" in f;
}

export const MIME_EXT: Record<string, string> = {
  "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/wav": "wav", "audio/flac": "flac", "audio/mp4": "m4a",
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif",
};

/** 直传对象生成路径：audio/<random>.<ext> */
export function uploadedObjectPath(kind: "audio" | "cover", mime: string): string {
  return `${kind === "audio" ? "audio" : "cover"}/${randomBytes(12).toString("hex")}.${MIME_EXT[mime]}`;
}

export interface SongDto {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  genre: string | null;
  year: number | null;
  durationSec: number | null;
  trackNo: number | null;
  description: string | null;
  lyrics: string | null;
  audio: { key: string; name: string; mime: string; size: number; url: string } | null;
  cover: { key: string; name: string; mime: string; size: number; url: string } | null;
  createdAt: string;
  updatedAt: string;
}

export function toDto(row: Song): SongDto {
  const { createdAt, updatedAt } = row;
  return {
    ...row,
    createdAt,
    updatedAt,
    audio: row.audioKey
      ? {
          key: row.audioKey, name: row.audioName ?? "", mime: row.audioMime ?? "", size: row.audioSize ?? 0,
          url: `/files/${row.audioKey}`,
        }
      : null,
    cover: row.coverKey
      ? {
          key: row.coverKey, name: row.coverName ?? "", mime: row.coverMime ?? "", size: row.coverSize ?? 0,
          url: `/files/${row.coverKey}`,
        }
      : null,
  };
}

export async function listSongs(query: SongQuery) {
  const db = await getDb();
  const where = buildWhere(query);
  const [items, [{ total }]] = await Promise.all([
    db
      .select()
      .from(schema.songs)
      .where(where)
      .orderBy(desc(schema.songs.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(schema.songs).where(where),
  ]);
  return { items: items.map(toDto), total, page: query.page, pageSize: query.pageSize };
}

function buildWhere(q: SongQuery): SQL | undefined {
  const conds: (SQL | undefined)[] = [];
  if (q.q) {
    const kw = `%${q.q}%`;
    conds.push(or(like(schema.songs.title, kw), like(schema.songs.artist, kw), like(schema.songs.album, kw)));
  }
  if (q.genre) conds.push(like(schema.songs.genre, `%${q.genre}%`));
  if (q.year) conds.push(eq(schema.songs.year, q.year));
  const valid = conds.filter((c): c is SQL => Boolean(c));
  return valid.length ? and(...valid) : undefined;
}

export async function getSong(id: string): Promise<SongDto> {
  const rows = await (await getDb()).select().from(schema.songs).where(eq(schema.songs.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "歌曲不存在");
  return toDto(row);
}

/** 剥离直传引用字段（已折算进 files，不得入库） */
function stripUploads<T extends object>(o: T): Omit<T, "audioUpload" | "coverUpload"> {
  const rest: Record<string, unknown> = { ...(o as Record<string, unknown>) };
  delete rest.audioUpload;
  delete rest.coverUpload;
  return rest as Omit<T, "audioUpload" | "coverUpload">;
}

export async function createSong(
  input: SongCreateInput,
  files: { audio?: IncomingFile; cover?: IncomingFile },
): Promise<SongDto> {
  const metaInput = stripUploads(input);
  const meta = files.audio && !isUploadedRef(files.audio) ? await extractMetadata(files.audio.buffer).catch(() => null) : null;
  const stored = await persistFiles(files);
  const merged = mergeAutofill(metaInput, meta);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const db = await getDb();
  await db.insert(schema.songs).values({
    id,
    ...merged,
    audioKey: stored.audio?.key ?? null,
    audioName: stored.audio?.name ?? null,
    audioMime: stored.audio?.mime ?? null,
    audioSize: stored.audio?.size ?? null,
    coverKey: stored.cover?.key ?? null,
    coverName: stored.cover?.name ?? null,
    coverMime: stored.cover?.mime ?? null,
    coverSize: stored.cover?.size ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return getSong(id);
}

export async function updateSong(
  id: string,
  patch: SongUpdateInput,
  files: { audio?: IncomingFile; cover?: IncomingFile },
): Promise<SongDto> {
  const current = await getSong(id); // 404 检查 + 旧文件键捕获
  const metaPatch = stripUploads(patch);
  const stored = await persistFiles(files);
  const db = await getDb();
  await db
    .update(schema.songs)
    .set({
      ...metaPatch,
      ...(stored.audio && { audioKey: stored.audio.key, audioName: stored.audio.name, audioMime: stored.audio.mime, audioSize: stored.audio.size }),
      ...(stored.cover && { coverKey: stored.cover.key, coverName: stored.cover.name, coverMime: stored.cover.mime, coverSize: stored.cover.size }),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.songs.id, id));
  // 更新成功后再清理被替换的旧对象，失败不影响主流程
  await Promise.all(
    [stored.audio && current.audio?.key, stored.cover && current.cover?.key]
      .filter((k): k is string => Boolean(k))
      .map((k) => deleteStoredObject(k)),
  );
  return getSong(id);
}

export async function deleteSong(id: string): Promise<void> {
  const song = await getSong(id);
  await Promise.all(
    [song.audio?.key, song.cover?.key].filter((k): k is string => Boolean(k)).map(deleteStoredObject),
  );
  await (await getDb()).delete(schema.songs).where(eq(schema.songs.id, id));
}

/** 按复合键（driver:path）路由到对应适配器删除，容忍后端已下线的情况 */
async function deleteStoredObject(storedKey: string): Promise<void> {
  try {
    const adapter = await getStorageForKey(storedKey);
    await adapter?.delete(storedKey.replace(/^[a-z0-9]+:/, ""));
  } catch (err) {
    console.warn(`[storage] 清理对象失败（忽略）: ${storedKey}`, err);
  }
}

/** 校验大小/魔数并写入当前存储后端，或复核直传对象，返回复合键（driver:path） */
async function persistFiles(files: { audio?: IncomingFile; cover?: IncomingFile }) {
  const settings = await getSettings();
  const storage = await getStorage();
  const store = async (file: IncomingFile | undefined, kind: "audio" | "image", limit: number): Promise<StoredMeta | undefined> => {
    if (!file) return undefined;
    const label = kind === "audio" ? "音频" : "图片";
    if (isUploadedRef(file)) return resolveUploadedRef(file, kind, limit, label);
    if (file.buffer.byteLength === 0) throw new ApiError(422, ERROR_CODES.VALIDATION, `${label}文件为空`);
    if (file.buffer.byteLength > limit) {
      throw new ApiError(413, ERROR_CODES.PAYLOAD_TOO_LARGE, `${label}超过大小限制`);
    }
    const mime = sniffMime(file.buffer.subarray(0, 32), kind);
    if (!mime) throw new ApiError(415, ERROR_CODES.UNSUPPORTED_MEDIA_TYPE, `${label}格式不受支持`);
    const path = `${kind === "audio" ? "audio" : "cover"}/${randomBytes(12).toString("hex")}.${MIME_EXT[mime]}`;
    await storage.put(path, file.buffer, mime);
    return { key: composeKey(storage.driver, path), name: file.originalName, mime, size: file.buffer.byteLength };
  };
  return {
    audio: await store(files.audio, "audio", settings.upload.audioMaxBytes),
    cover: await store(files.cover, "image", settings.upload.imageMaxBytes),
  };
}

interface StoredMeta {
  key: string;
  name: string;
  mime: string;
  size: number;
}

/**
 * 直传复核：不信任客户端声明，用 head() 取对象实际大小/类型校验。
 * 键必须属于当前 S3 后端且位于本服务生成的 audio/ 或 cover/ 目录内。
 */
async function resolveUploadedRef(ref: UploadedRef, kind: "audio" | "image", limit: number, label: string): Promise<StoredMeta> {
  const parsed = parseStoredKey(ref.refKey);
  const allowedPrefix = kind === "audio" ? "audio/" : "cover/";
  if (!parsed || parsed.driver !== "s3" || !parsed.path.startsWith(allowedPrefix) || parsed.path.includes("..")) {
    throw new ApiError(422, ERROR_CODES.VALIDATION, `${label}上传键非法`);
  }
  const adapter = await getStorageForKey(ref.refKey);
  if (!adapter?.head) throw new ApiError(422, ERROR_CODES.VALIDATION, "当前存储后端不支持直传对象");
  const meta = await adapter.head(parsed.path);
  const whitelist = kind === "audio" ? AUDIO_MIMES : IMAGE_MIMES;
  if (!meta || meta.size === 0 || meta.size > limit || !whitelist.includes(meta.contentType as never)) {
    throw new ApiError(415, ERROR_CODES.VALIDATION, `${label}直传对象校验失败（不存在/超限/类型不符）`);
  }
  return { key: ref.refKey, name: ref.name, mime: meta.contentType, size: meta.size };
}

/** music-metadata 解析音频标签，用于创建时自动回填空字段 */
async function extractMetadata(buffer: Buffer) {
  const { common, format } = await parseBuffer(buffer);
  return {
    title: common.title,
    artist: common.artist ?? common.artists?.[0],
    album: common.album,
    genre: common.genre?.[0],
    year: common.year,
    trackNo: common.track?.no ?? null,
    durationSec: format.duration ? Math.round(format.duration) : null,
  };
}

function mergeAutofill(input: SongCreateInput, meta: Awaited<ReturnType<typeof extractMetadata>> | null) {
  if (!meta) return input;
  const pick = (v: string | null | undefined, fallback: string | null | undefined) =>
    v ?? (fallback?.toString().slice(0, 200) || null);
  return {
    ...input,
    title: pick(input.title, meta.title) ?? "未命名",
    artist: pick(input.artist, meta.artist),
    album: pick(input.album, meta.album),
    genre: pick(input.genre, meta.genre),
    year: input.year ?? (meta.year && meta.year >= 1000 && meta.year <= 3000 ? meta.year : null),
    trackNo: input.trackNo ?? meta.trackNo,
    durationSec: input.durationSec ?? meta.durationSec,
  };
}
