import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { localStorage } from "@/server/storage/local";
import { parseStoredKey } from "@/server/storage/types";

describe("local storage", () => {
  const root = mkdtempSync(join(tmpdir(), "fmm-store-"));
  const store = localStorage(root);
  const key = "audio/abc123.mp3";

  afterEach(() => rmSync(join(root, "audio"), { recursive: true, force: true }));

  it("put/get/delete 往返", async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    await store.put(key, data);
    const obj = await store.get(key);
    expect(obj).not.toBeNull();
    expect(obj!.total).toBe(5);
    const buf = new Uint8Array(await new Response(obj!.stream).arrayBuffer());
    expect([...buf]).toEqual([1, 2, 3, 4, 5]);
    await store.delete(key);
    expect(await store.get(key)).toBeNull();
  });

  it("Range 读取返回区间与全量大小", async () => {
    await store.put(key, new Uint8Array([10, 20, 30, 40, 50]));
    const obj = await store.get(key, { start: 1, end: 3 });
    const buf = new Uint8Array(await new Response(obj!.stream).arrayBuffer());
    expect([...buf]).toEqual([20, 30, 40]);
    expect(obj!.size).toBe(3);
    expect(obj!.total).toBe(5);
  });

  it("拒绝路径穿越与非法键", async () => {
    await expect(store.put("../evil.txt", new Uint8Array())).rejects.toThrow("非法存储键");
    await expect(store.put("a/b/../../c", new Uint8Array())).rejects.toThrow("非法存储键");
    await expect(store.put("/abs/path", new Uint8Array())).rejects.toThrow("非法存储键");
    expect(await store.get("../secret")).toBeNull(); // get 同样收敛为 null 而非抛错后泄露
  });
});

describe("parseStoredKey（复合键解析）", () => {
  it("接受合法 driver:path", () => {
    expect(parseStoredKey("local:audio/ab.mp3")).toEqual({ driver: "local", path: "audio/ab.mp3" });
    expect(parseStoredKey("s3:cover/x.png")).toEqual({ driver: "s3", path: "cover/x.png" });
  });

  it("拒绝穿越、非法字符与缺前缀", () => {
    expect(parseStoredKey("local:../evil")).toBeNull();
    expect(parseStoredKey("audio/ab.mp3")).toBeNull();
    expect(parseStoredKey("ftp:x")).toBeNull();
    expect(parseStoredKey("local:")).toBeNull();
  });
});
