import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * 规范 Schema（SQLite 方言）。mysql.ts / postgres.ts 为同构镜像，
 * 三者列名一致性由 tests/db-schema.test.ts 校验，修改任一文件须同步其余两份。
 * 约定：主键 uuid 文本、时间戳 ISO 文本、数值 integer —— 保证三方言同构可迁移。
 */

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const ts = (name: string) => text(name).$defaultFn(() => new Date().toISOString());

export const users = sqliteTable("users", {
  id: id(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("admin"),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: id(),
    userId: text("user_id").notNull(),
    refreshHash: text("refresh_hash").notNull().unique(),
    ua: text("ua"),
    ip: text("ip"),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
    createdAt: ts("created_at").notNull(),
  },
  (t) => [index("idx_sessions_user").on(t.userId)],
);

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: id(),
    name: text("name").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    scopes: text("scopes").notNull(), // 逗号分隔，如 "songs:read,songs:write"
    allowedDomains: text("allowed_domains").notNull().default(""), // 逗号分隔域名白名单，空 = 不限
    rateLimit: integer("rate_limit").notNull().default(60),
    lastUsedAt: text("last_used_at"),
    expiresAt: text("expires_at"),
    revokedAt: text("revoked_at"),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
  },
);

export const songs = sqliteTable(
  "songs",
  {
    id: id(),
    title: text("title").notNull(),
    artist: text("artist"),
    album: text("album"),
    genre: text("genre"),
    year: integer("year"),
    durationSec: integer("duration_sec"),
    trackNo: integer("track_no"),
    description: text("description"),
    lyrics: text("lyrics"),
    audioKey: text("audio_key"),
    audioName: text("audio_name"),
    audioMime: text("audio_mime"),
    audioSize: integer("audio_size"),
    coverKey: text("cover_key"),
    coverName: text("cover_name"),
    coverMime: text("cover_mime"),
    coverSize: integer("cover_size"),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
  },
  (t) => [index("idx_songs_created").on(t.createdAt)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON 字符串
  updatedAt: ts("updated_at").notNull(),
});
