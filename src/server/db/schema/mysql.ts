import { int, mysqlTable, text, index } from "drizzle-orm/mysql-core";

/** SQLite 规范 Schema 的 MySQL 镜像（列名/语义必须一致，见 sqlite.ts 注释） */

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const ts = (name: string) => text(name).$defaultFn(() => new Date().toISOString());

export const users = mysqlTable("users", {
  id: id(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("admin"),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

export const sessions = mysqlTable(
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

export const apiKeys = mysqlTable("api_keys", {
  id: id(),
  name: text("name").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  scopes: text("scopes").notNull(),
  rateLimit: int("rate_limit").notNull().default(60),
  lastUsedAt: text("last_used_at"),
  expiresAt: text("expires_at"),
  revokedAt: text("revoked_at"),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

export const songs = mysqlTable(
  "songs",
  {
    id: id(),
    title: text("title").notNull(),
    artist: text("artist"),
    album: text("album"),
    genre: text("genre"),
    year: int("year"),
    durationSec: int("duration_sec"),
    trackNo: int("track_no"),
    description: text("description"),
    lyrics: text("lyrics"),
    audioKey: text("audio_key"),
    audioName: text("audio_name"),
    audioMime: text("audio_mime"),
    audioSize: int("audio_size"),
    coverKey: text("cover_key"),
    coverName: text("cover_name"),
    coverMime: text("cover_mime"),
    coverSize: int("cover_size"),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
  },
  (t) => [index("idx_songs_created").on(t.createdAt)],
);

export const settings = mysqlTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: ts("updated_at").notNull(),
});
