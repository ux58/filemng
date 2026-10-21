import { defineConfig } from "drizzle-kit";

/**
 * 以环境变量决定方言与 schema：DATABASE_DRIVER=sqlite|mysql|postgres
 * sqlite 迁移文件随项目提供并在启动时自动执行；mysql/postgres 需先运行 db:push。
 */
const driver = (process.env.DATABASE_DRIVER ?? "sqlite") as "sqlite" | "mysql" | "postgres";

const common = { out: "./drizzle" } as const;

export default defineConfig(
  driver === "mysql"
    ? { ...common, dialect: "mysql", schema: "./src/server/db/schema/mysql.ts", dbCredentials: { url: process.env.DATABASE_URL! } }
    : driver === "postgres"
      ? { ...common, dialect: "postgresql", schema: "./src/server/db/schema/postgres.ts", dbCredentials: { url: process.env.DATABASE_URL! } }
      : { ...common, dialect: "sqlite", schema: "./src/server/db/schema/sqlite.ts", dbCredentials: { url: (process.env.DATABASE_URL ?? "file:./data/app.db").replace(/^file:/, "") } },
);
