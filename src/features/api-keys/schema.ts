import { z } from "zod";
import { DOMAIN_PATTERN, SCOPES } from "@/shared/constants";

export const apiKeyCreateSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  scopes: z.array(z.enum(SCOPES)).min(1),
  rateLimit: z.number().int().min(1).max(10_000).default(60),
  /** ISO 日期字符串，可选 */
  expiresAt: z.string().datetime().nullable().default(null),
  /** 域名白名单：为空不限来源；配置后仅允许白名单域名的浏览器调用 */
  allowedDomains: z.array(z.string().trim().regex(DOMAIN_PATTERN, "域名格式不合法")).max(20).default([]),
});

export type ApiKeyCreateInput = z.infer<typeof apiKeyCreateSchema>;
