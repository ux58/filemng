import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireScope } from "@/server/auth/guard";
import { jsonError, ApiError } from "@/server/http";
import { getSettings } from "@/server/settings/service";
import { composeKey, getStorage } from "@/server/storage";
import { uploadedObjectPath } from "@/features/songs/service";
import { uploadUrlSchema } from "@/features/songs/schema";
import { AUDIO_MIMES, ERROR_CODES, IMAGE_MIMES } from "@/shared/constants";

const PRESIGN_TTL_SEC = 600;

/**
 * 签发客户端直传 PUT URL（Serverless 部署绕过请求体上限）。
 * 仅校验 MIME/大小声明；真实复核在创建/更新歌曲时以 head() 完成，不信任客户端。
 */
export async function POST(req: NextRequest) {
  try {
    await requireScope(req, "songs:write");
    const body = uploadUrlSchema.parse(await req.json());
    const isAudio = body.kind === "audio";
    const whitelist = (isAudio ? AUDIO_MIMES : IMAGE_MIMES) as readonly string[];
    if (!whitelist.includes(body.mime)) {
      throw new ApiError(415, ERROR_CODES.UNSUPPORTED_MEDIA_TYPE, `${isAudio ? "音频" : "图片"}格式不受支持`);
    }
    const settings = await getSettings();
    const limit = isAudio ? settings.upload.audioMaxBytes : settings.upload.imageMaxBytes;
    if (body.size > limit) {
      throw new ApiError(413, ERROR_CODES.PAYLOAD_TOO_LARGE, `${isAudio ? "音频" : "图片"}超过大小限制`);
    }
    const storage = await getStorage();
    if (!storage.presignPut) {
      throw new ApiError(400, ERROR_CODES.VALIDATION, "当前存储后端不支持直传，请使用 multipart 上传");
    }
    const path = uploadedObjectPath(body.kind, body.mime);
    const url = await storage.presignPut(path, body.mime, PRESIGN_TTL_SEC);
    return NextResponse.json({ url, key: composeKey(storage.driver, path), mime: body.mime, expiresIn: PRESIGN_TTL_SEC });
  } catch (err) {
    return jsonError(err);
  }
}
