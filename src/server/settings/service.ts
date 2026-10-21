import { eq } from "drizzle-orm";
import { z } from "zod";
import { DEFAULT_SETTINGS } from "@/shared/constants";
import { getDb, schema } from "@/server/db";

export const appSettingsSchema = z.object({
  storage: z.object({
    driver: z.enum(["local", "s3"]),
    localRoot: z.string().min(1),
    s3: z.object({
      endpoint: z.string(),
      region: z.string(),
      bucket: z.string(),
      accessKeyId: z.string(),
      /** 空字符串表示保留原值（更新时占位，不回传真实密钥） */
      secretAccessKey: z.string(),
    }),
  }),
  upload: z.object({
    audioMaxBytes: z.number().int().min(1).max(2 * 1024 ** 3),
    imageMaxBytes: z.number().int().min(1).max(256 * 1024 * 1024),
  }),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

const SETTINGS_KEY = "app";
let cache: AppSettings | null = null;

export async function getSettings(): Promise<AppSettings> {
  if (cache) return cache;
  const db = await getDb();
  const row = await db.select().from(schema.settings).where(eq(schema.settings.key, SETTINGS_KEY)).limit(1);
  const stored = row[0] ? (JSON.parse(row[0].value) as object) : {};
  // 深合并默认值，保证新增配置项向后兼容
  cache = appSettingsSchema.parse({
    storage: {
      ...DEFAULT_SETTINGS.storage,
      ...(stored as { storage?: object }).storage,
      s3: { ...DEFAULT_SETTINGS.storage.s3, ...((stored as { storage?: { s3?: object } }).storage?.s3 ?? {}) },
    },
    upload: { ...DEFAULT_SETTINGS.upload, ...(stored as { upload?: object }).upload },
  });
  return cache;
}

/** 深合并更新；secretAccessKey 传空串表示保留原值。写入后失效缓存。 */
export async function updateSettings(patch: unknown): Promise<AppSettings> {
  const current = await getSettings();
  const parsed = appSettingsSchema.parse({
    storage: {
      ...current.storage,
      ...(patch as AppSettings).storage,
      s3: { ...current.storage.s3, ...((patch as AppSettings).storage?.s3 ?? {}) },
    },
    upload: { ...current.upload, ...(patch as AppSettings).upload },
  });
  if (parsed.storage.s3.secretAccessKey === "") {
    parsed.storage.s3.secretAccessKey = current.storage.s3.secretAccessKey;
  }
  const db = await getDb();
  const value = JSON.stringify(parsed);
  const now = new Date().toISOString();
  // 方言中立的 upsert（三库均无统一 onConflict API）
  const existing = await db
    .select({ key: schema.settings.key })
    .from(schema.settings)
    .where(eq(schema.settings.key, SETTINGS_KEY))
    .limit(1);
  if (existing[0]) {
    await db.update(schema.settings).set({ value, updatedAt: now }).where(eq(schema.settings.key, SETTINGS_KEY));
  } else {
    await db.insert(schema.settings).values({ key: SETTINGS_KEY, value, updatedAt: now });
  }
  cache = parsed;
  return parsed;
}

/** 测试隔离用 */
export function resetSettingsCache(): void {
  cache = null;
}
