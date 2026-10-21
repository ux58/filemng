import { z } from "zod";
import { SCOPES } from "@/shared/constants";

export const apiKeyCreateSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  scopes: z.array(z.enum(SCOPES)).min(1),
  rateLimit: z.number().int().min(1).max(10_000).default(60),
  /** ISO 日期字符串，可选 */
  expiresAt: z.string().datetime().nullable().default(null),
});

export type ApiKeyCreateInput = z.infer<typeof apiKeyCreateSchema>;
