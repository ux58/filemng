import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { API_KEY_PREFIX } from "@/shared/constants";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const KEY_BODY_LEN = 43; // 32 字节熵 ≈ 256 bit

/** 生成 API Key：fmm_ + 43 位 Base62。仅在创建时返回明文，落库仅存 SHA-256 */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const bytes = randomBytes(KEY_BODY_LEN);
  let body = "";
  for (let i = 0; i < KEY_BODY_LEN; i++) body += ALPHABET[bytes[i]! % ALPHABET.length];
  const key = API_KEY_PREFIX + body;
  return { key, prefix: key.slice(0, API_KEY_PREFIX.length + 6), hash: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** 定长时间比较哈希，防时序侧信道 */
export function hashEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
