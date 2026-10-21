import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { env } from "@/server/env";
import * as schema from "./schema/sqlite";

export type AppDb = BetterSQLite3Database<typeof schema>;
export { schema };
export type Song = typeof schema.songs.$inferSelect;
export type ApiKey = typeof schema.apiKeys.$inferSelect;
export type User = typeof schema.users.$inferSelect;

/**
 * 多驱动连接工厂（懒加载进程级单例）。
 * 服务层以 SQLite 方言类型为准编程；MySQL/Postgres 实例在本文件内一次性收敛转换 ——
 * 服务层仅使用跨方言一致的构建器 API（select/insert/update/delete/where/limit...，
 * 不使用 MySQL 不支持的 .returning()），运行时行为完全一致。
 */
let dbPromise: Promise<AppDb> | null = null;

export function getDb(): Promise<AppDb> {
  dbPromise ??= initDb().catch((err) => {
    dbPromise = null; // 失败后允许重试
    throw err;
  });
  return dbPromise;
}

async function initDb(): Promise<AppDb> {
  switch (env.DATABASE_DRIVER) {
    case "mysql": {
      const { drizzle: drizzleMysql } = await import("drizzle-orm/mysql2");
      const mysql = await import("mysql2/promise");
      const conn = await mysql.createConnection(env.DATABASE_URL);
      await assertMigrated(
        (drizzleMysql(conn) as unknown as AppDb).select().from(schema.settings).limit(1),
      );
      return drizzleMysql(conn) as unknown as AppDb;
    }
    case "postgres": {
      const { drizzle: drizzlePg } = await import("drizzle-orm/postgres-js");
      const postgres = (await import("postgres")).default;
      const sql = postgres(env.DATABASE_URL, { max: 10 });
      await assertMigrated((drizzlePg(sql) as unknown as AppDb).select().from(schema.settings).limit(1));
      return drizzlePg(sql) as unknown as AppDb;
    }
    default:
      return initSqlite(env.DATABASE_URL);
  }
}

async function initSqlite(url: string): Promise<AppDb> {
  const file = url.replace(/^file:/, "");
  if (file !== ":memory:") await mkdir(dirname(resolve(file)), { recursive: true });
  const db = drizzle(new Database(file)) as unknown as AppDb;
  // SQLite 默认开箱即用：首次访问自动执行随项目分发的迁移
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

async function assertMigrated(probe: Promise<unknown>): Promise<void> {
  try {
    await probe;
  } catch {
    throw new Error(
      `${env.DATABASE_DRIVER} 数据库尚未建表：请先设置 DATABASE_URL 并运行 npm run db:push`,
    );
  }
}

/** 测试专用：注入实例（如 :memory: 库），传 null 还原为懒加载初始化 */
export function setDbForTests(db: AppDb | null): void {
  dbPromise = db ? Promise.resolve(db) : null;
}
