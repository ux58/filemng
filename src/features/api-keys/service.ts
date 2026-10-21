import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { ApiError } from "@/server/http";
import { generateApiKey } from "@/server/security/api-key";
import { ERROR_CODES } from "@/shared/constants";
import type { ApiKeyCreateInput } from "./schema";

export interface ApiKeyDto {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimit: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

const toDto = (row: typeof schema.apiKeys.$inferSelect): ApiKeyDto => ({
  id: row.id,
  name: row.name,
  keyPrefix: row.keyPrefix,
  scopes: row.scopes.split(","),
  rateLimit: row.rateLimit,
  lastUsedAt: row.lastUsedAt,
  expiresAt: row.expiresAt,
  revokedAt: row.revokedAt,
  createdAt: row.createdAt,
});

export async function listApiKeys(): Promise<ApiKeyDto[]> {
  const db = await getDb();
  const rows = await db.select().from(schema.apiKeys).orderBy(desc(schema.apiKeys.createdAt));
  return rows.map(toDto);
}

/** 明文 key 仅在此返回一次，落库为 SHA-256 */
export async function createApiKey(input: ApiKeyCreateInput): Promise<{ dto: ApiKeyDto; key: string }> {
  const db = await getDb();
  const { key, prefix, hash } = generateApiKey();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.apiKeys).values({
    id,
    name: input.name,
    keyPrefix: prefix,
    keyHash: hash,
    scopes: input.scopes.join(","),
    rateLimit: input.rateLimit,
    expiresAt: input.expiresAt,
    createdAt: now,
    updatedAt: now,
  });
  const rows = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.id, id)).limit(1);
  return { dto: toDto(rows[0]!), key };
}

export async function revokeApiKey(id: string): Promise<void> {
  const db = await getDb();
  const rows = await db.select({ id: schema.apiKeys.id }).from(schema.apiKeys).where(eq(schema.apiKeys.id, id)).limit(1);
  if (!rows[0]) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "API Key 不存在");
  await db
    .update(schema.apiKeys)
    .set({ revokedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(schema.apiKeys.id, id));
}
