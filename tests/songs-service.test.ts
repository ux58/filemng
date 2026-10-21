import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setDbForTests, type AppDb } from "@/server/db";
import { resetSettingsCache } from "@/server/settings/service";
import { resetStorageCache } from "@/server/storage";
import { localStorage } from "@/server/storage/local";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** 歌曲服务集成测试：内存 SQLite + 临时本地存储，走真实 service 层 */

let root: string;
let cleanupDir: () => void;

beforeAll(async () => {
  // :memory: 库并执行迁移
  const db = drizzle(new Database(":memory:")) as unknown as AppDb;
  await migrate(db, { migrationsFolder: "drizzle" });
  setDbForTests(db);

  // 临时存储目录
  root = mkdtempSync(join(tmpdir(), "fmm-songs-"));
  cleanupDir = () => rmSync(root, { recursive: true, force: true });
  // settings 缓存注入本地存储配置
  resetSettingsCache();
  resetStorageCache();
  const { updateSettings } = await import("@/server/settings/service");
  await updateSettings({ storage: { driver: "local", localRoot: root, s3: {} }, upload: {} });
});

afterAll(() => cleanupDir?.());

async function importService() {
  return import("@/features/songs/service");
}

const MP3 = Buffer.concat([
  Buffer.from("ID3\x04\x00\x00\x00\x00\x00\x00", "binary"),
  Buffer.alloc(64, 7),
]);

describe("songs service CRUD（集成）", () => {
  it("创建 → 查询 → 更新 → 删除 全链路，文件随建随删", async () => {
    const svc = await importService();
    const created = await svc.createSong(
      { title: "测试歌", artist: "某人", album: null, genre: null, year: 2024, durationSec: 180, trackNo: null, description: null, lyrics: "啦啦啦" },
      { audio: { buffer: MP3, originalName: "test.mp3" } },
    );
    // ID3 无真实时长信息时保留传入值
    expect(created.title).toBe("测试歌");
    expect(created.audio).not.toBeNull();
    expect(created.audio!.url).toMatch(/^\/files\/local:audio\//);

    // 文件确实落盘
    const store = localStorage(root);
    const path = created.audio!.key.replace(/^local:/, "");
    expect(await store.get(path)).not.toBeNull();

    // 列表
    const list = await svc.listSongs({ page: 1, pageSize: 10, q: "测试" });
    expect(list.total).toBe(1);
    expect(list.items[0]!.id).toBe(created.id);

    // 过滤不命中
    const none = await svc.listSongs({ page: 1, pageSize: 10, q: "不存在" });
    expect(none.total).toBe(0);

    // 更新（含封面替换语义：无旧封面时不误删）
    const updated = await svc.updateSong(created.id, { lyrics: "新歌词" }, {});
    expect(updated.lyrics).toBe("新歌词");
    expect(updated.audio!.key).toBe(created.audio!.key); // 未替换文件键不变

    // 删除：记录与文件同灭
    await svc.deleteSong(created.id);
    expect(await store.get(path)).toBeNull();
    await expect(svc.getSong(created.id)).rejects.toMatchObject({ status: 404 });
  });

  it("非法存储键的文件读取返回 null 而非异常", async () => {
    const { getStorageForKey } = await import("@/server/storage");
    expect(await getStorageForKey("local:../evil")).toBeNull();
  });
});
