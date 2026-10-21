import { getSettings } from "@/server/settings/service";
import { localStorage } from "./local";
import { S3Storage } from "./s3";
import { composeKey, parseStoredKey, type StorageAdapter } from "./types";

export { composeKey, parseStoredKey };
export type { StorageAdapter, StorageRange, StoredObject } from "./types";

let adapterCache: { adapter: StorageAdapter; sig: string } | null = null;

/** 当前上传后端（由设置决定，配置变更后自动重建） */
export async function getStorage(): Promise<StorageAdapter> {
  const s = await getSettings();
  const sig = JSON.stringify(s.storage);
  if (adapterCache?.sig === sig) return adapterCache.adapter;
  const adapter =
    s.storage.driver === "s3"
      ? new S3Storage(s.storage.s3)
      : localStorage(s.storage.localRoot);
  adapterCache = { adapter, sig };
  return adapter;
}

/** 读取历史文件：按存储键中的 driver 前缀路由到对应适配器 */
export async function getStorageForKey(storedKey: string): Promise<StorageAdapter | null> {
  const parsed = parseStoredKey(storedKey);
  if (!parsed) return null;
  const s = await getSettings();
  if (parsed.driver === "local") return localStorage(s.storage.localRoot);
  if (!s.storage.s3.bucket || !s.storage.s3.accessKeyId) return null; // 未配置 S3 则历史对象不可达
  return new S3Storage(s.storage.s3);
}

export function resetStorageCache(): void {
  adapterCache = null;
}
