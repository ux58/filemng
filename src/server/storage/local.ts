import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { randomBytes } from "node:crypto";
import type { StorageAdapter, StorageRange, StoredObject } from "./types";

/** 本地磁盘适配器：默认降级存储，root 可经设置页配置（相对路径基于项目根） */
export class LocalStorage implements StorageAdapter {
  readonly driver = "local" as const;
  constructor(private readonly root: string) {}

  private resolveKey(key: string): string {
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(key) || key.includes("..")) {
      throw new Error("非法存储键");
    }
    return resolve(this.root, key);
  }

  async put(key: string, data: Uint8Array): Promise<void> {
    const file = this.resolveKey(key);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, data);
  }

  async get(key: string, range?: StorageRange): Promise<StoredObject | null> {
    let file: string;
    try {
      file = this.resolveKey(key);
    } catch {
      return null; // 非法键（含路径穿越）统一视为不存在
    }
    try {
      const st = await stat(file);
      if (!st.isFile()) return null;
      const start = range?.start ?? 0;
      const end = Math.min(range?.end ?? st.size - 1, st.size - 1);
      if (start > end || start >= st.size) return null;
      const stream = Readable.toWeb(
        createReadStream(file, { start, end }),
      ) as ReadableStream<Uint8Array>;
      return { stream, size: end - start + 1, total: st.size };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  async test(): Promise<void> {
    const probe = `.probe-${randomBytes(6).toString("hex")}`;
    await this.put(probe, new Uint8Array(1));
    await this.delete(probe);
  }
}

export function localStorage(root: string): LocalStorage {
  return new LocalStorage(resolve(root));
}
