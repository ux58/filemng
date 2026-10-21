import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 三方言 Schema 镜像一致性守卫：列名、表名必须与规范版（sqlite.ts）完全一致，
 * 防止修改任一文件后镜像漂移。
 */

type TableDef = { name: string; columns: string[] };

function extractTables(file: string): TableDef[] {
  const src = readFileSync(file, "utf8");
  const tables: TableDef[] = [];
  // 按 export const 分块，避免跨表正则吞噬；列对象内无嵌套大括号，可整块捕获
  for (const chunk of src.split(/(?=export const )/)) {
    const name = chunk.match(/\w+Table\(\s*"(\w+)"/)?.[1];
    const body = chunk.slice(chunk.indexOf("{")).match(/\{([^{}]*)\}/)?.[1];
    if (!name || !body) continue;
    const columns = [...body.matchAll(/^\s+(\w+):/gm)].map((c) => c[1]!);
    tables.push({ name, columns });
  }
  return tables;
}

const dir = join(__dirname, "../src/server/db/schema");
const canonical = extractTables(join(dir, "sqlite.ts"));
const dialects = readdirSync(dir).filter((f) => f !== "sqlite.ts" && f.endsWith(".ts"));

describe("db schema 三方言一致性", () => {
  it("规范版包含全部 5 张表", () => {
    expect(canonical.map((t) => t.name).sort()).toEqual(["api_keys", "sessions", "settings", "songs", "users"]);
  });

  for (const dialect of dialects) {
    it(`${dialect} 与 sqlite.ts 列定义一致`, () => {
      const mirrored = extractTables(join(dir, dialect));
      expect(mirrored).toEqual(canonical);
    });
  }
});
