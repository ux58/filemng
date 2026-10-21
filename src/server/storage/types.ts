export interface StorageRange {
  start: number;
  end: number; // 含端点
}

export interface StoredObject {
  stream: ReadableStream<Uint8Array>;
  size: number; // 本次返回的字节数（Range 时为区间长度）
  total?: number; // 对象全量大小（Range 响应计算 Content-Range 用）
}

export interface StorageAdapter {
  readonly driver: "local" | "s3";
  put(key: string, data: Uint8Array, mime: string): Promise<void>;
  get(key: string, range?: StorageRange): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
  /** 连接/权限探测，失败抛错 */
  test(): Promise<void>;
}

/** DB 中存储的复合键：driver:path（如 local:songs/xx.mp3），便于历史文件跨后端读取 */
export function composeKey(driver: "local" | "s3", path: string): string {
  return `${driver}:${path}`;
}

export function parseStoredKey(key: string): { driver: "local" | "s3"; path: string } | null {
  const m = /^((local)|(s3)):([A-Za-z0-9][A-Za-z0-9._/-]*)$/.exec(key);
  if (!m || key.includes("..")) return null;
  return { driver: m[1] as "local" | "s3", path: m[4]! };
}
