import { z } from "zod";

/** 引导级配置：进程启动时解析，数据库连接等无法存于数据库自身的信息在此管理 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_DRIVER: z.enum(["sqlite", "mysql", "postgres"]).default("sqlite"),
  DATABASE_URL: z.string().default("file:./data/app.db"),
  JWT_SECRET: z.string().min(32).optional(),
});

const parsed = envSchema.parse(process.env);

let devSecret: string | null = null;
let warned = false;

export const env = {
  NODE_ENV: parsed.NODE_ENV,
  DATABASE_DRIVER: parsed.DATABASE_DRIVER,
  DATABASE_URL: parsed.DATABASE_URL,
  isProd: parsed.NODE_ENV === "production",
  /** 惰性求值：构建期收集路由信息时不触发校验，首次签名时才要求生产密钥 */
  get JWT_SECRET(): string {
    if (parsed.JWT_SECRET) return parsed.JWT_SECRET;
    if (parsed.NODE_ENV === "production") {
      throw new Error("生产环境必须设置 JWT_SECRET（>=32 字节随机串），参见 .env.example");
    }
    devSecret ??= crypto.randomUUID() + crypto.randomUUID();
    if (!warned) {
      warned = true;
      console.warn("[env] JWT_SECRET 未设置，已生成临时开发密钥（重启后登录态失效）");
    }
    return devSecret;
  },
} as const;
