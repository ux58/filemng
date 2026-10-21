/** 全局共享常量（前后端通用，禁止引入服务端依赖） */

export const APP_NAME = "FileMng 音乐库";

export const SCOPES = ["songs:read", "songs:write"] as const;
export type Scope = (typeof SCOPES)[number];

export const COOKIE_ACCESS = "fmm_at";
export const COOKIE_REFRESH = "fmm_rt";

export const ACCESS_TOKEN_TTL_SEC = 2 * 60 * 60; // 2h
export const REFRESH_TOKEN_TTL_SEC = 14 * 24 * 60 * 60; // 14d

export const API_KEY_PREFIX = "fmm_";
export const API_KEY_DEFAULT_RPM = 60;

export const ERROR_CODES = {
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  NOT_FOUND: "not_found",
  VALIDATION: "validation_error",
  RATE_LIMITED: "rate_limited",
  CONFLICT: "conflict",
  PAYLOAD_TOO_LARGE: "payload_too_large",
  UNSUPPORTED_MEDIA_TYPE: "unsupported_media_type",
  INTERNAL: "internal_error",
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** 魔数嗅探允许的 MIME 白名单 */
export const AUDIO_MIMES = ["audio/mpeg", "audio/ogg", "audio/wav", "audio/flac", "audio/mp4"] as const;
export const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"] as const;

/** 运行时设置默认值（存储后端与上传限额） */
export const DEFAULT_SETTINGS = {
  storage: {
    driver: "local" as "local" | "s3",
    localRoot: "./uploads",
    s3: {
      endpoint: "",
      region: "",
      bucket: "",
      accessKeyId: "",
      secretAccessKey: "",
    },
  },
  upload: {
    audioMaxBytes: 100 * 1024 * 1024,
    imageMaxBytes: 10 * 1024 * 1024,
  },
} as const;
