import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { ApiError } from "@/server/http";
import { hashPassword, isValidPassword, verifyPassword } from "@/server/security/password";
import { signAccessToken } from "@/server/security/jwt";
import { ERROR_CODES, REFRESH_TOKEN_TTL_SEC } from "@/shared/constants";

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  user: { id: string; username: string; role: string };
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const expiryDate = () => new Date(Date.now() + REFRESH_TOKEN_TTL_SEC * 1000).toISOString();

export async function hasAnyUser(): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  return rows.length > 0;
}

export async function setupAdmin(username: string, password: string): Promise<IssuedTokens> {
  if (await hasAnyUser()) throw new ApiError(409, ERROR_CODES.CONFLICT, "管理员已初始化，请直接登录");
  if (!isValidPassword(password)) {
    throw new ApiError(422, ERROR_CODES.VALIDATION, "密码需 8-72 位且包含字母与数字");
  }
  const db = await getDb();
  const userId = crypto.randomUUID(); // 应用侧预生成主键，规避 MySQL 不支持的 .returning()
  await db.insert(schema.users).values({ id: userId, username, passwordHash: await hashPassword(password) });
  const user = (await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1))[0];
  if (!user) throw new ApiError(500, ERROR_CODES.INTERNAL, "初始化失败");
  return issueTokens(user, { ua: "setup", ip: "" });
}

export async function login(
  username: string,
  password: string,
  ua: string,
  ip: string,
): Promise<IssuedTokens> {
  const db = await getDb();
  const rows = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
  const user = rows[0];
  // 错误信息泛化：不区分用户不存在/密码错误
  const invalid = new ApiError(401, ERROR_CODES.UNAUTHORIZED, "用户名或密码错误");
  if (!user) {
    await verifyPassword(password, "$2a$12$C6UzMDM.H6dfI/f/IKcEeO7ZBpFqzMzE8lKZq0n0u0u0u0u0u0u0u"); // 定时掩蔽
    throw invalid;
  }
  if (!(await verifyPassword(password, user.passwordHash))) throw invalid;
  return issueTokens(user, { ua, ip });
}

/** 刷新令牌轮换：旧 refresh 一次性作废并签发新对 */
export async function refreshSession(refreshToken: string): Promise<IssuedTokens> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.refreshHash, sha256(refreshToken)))
    .limit(1);
  const session = rows[0];
  const unauthorized = new ApiError(401, ERROR_CODES.UNAUTHORIZED, "登录状态已失效，请重新登录");
  if (!session || session.revokedAt || session.expiresAt < new Date().toISOString()) throw unauthorized;
  const users = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);
  const user = users[0];
  if (!user) throw unauthorized;
  await db
    .update(schema.sessions)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(schema.sessions.id, session.id));
  return issueTokens(user, { ua: session.ua ?? "", ip: session.ip ?? "" });
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  const db = await getDb();
  await db
    .update(schema.sessions)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(schema.sessions.refreshHash, sha256(refreshToken)));
}

/** 校验 access JWT 对应会话未被吊销（Proxy 仅做密码学检查，此处查库为准） */
export async function resolveSession(sub: string, sid: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.sessions)
    .where(and(eq(schema.sessions.id, sid), isNull(schema.sessions.revokedAt)))
    .limit(1);
  const session = rows[0];
  if (!session || session.userId !== sub || session.expiresAt < new Date().toISOString()) return null;
  const users = await db.select().from(schema.users).where(eq(schema.users.id, sub)).limit(1);
  return users[0] ?? null;
}

async function issueTokens(
  user: typeof schema.users.$inferSelect,
  meta: { ua: string; ip: string },
): Promise<IssuedTokens> {
  const db = await getDb();
  const refreshToken = randomBytes(48).toString("base64url");
  const sessionId = crypto.randomUUID();
  await db.insert(schema.sessions).values({
    id: sessionId,
    userId: user.id,
    refreshHash: sha256(refreshToken),
    ua: meta.ua || null,
    ip: meta.ip || null,
    expiresAt: expiryDate(),
  });
  // 顺手清理本人已过期/已吊销的会话
  await db
    .delete(schema.sessions)
    .where(
      and(
        eq(schema.sessions.userId, user.id),
        or(lt(schema.sessions.expiresAt, new Date().toISOString()), lt(schema.sessions.revokedAt, new Date().toISOString())),
      ),
    );
  return {
    accessToken: await signAccessToken({ sub: user.id, sid: sessionId }),
    refreshToken,
    user: { id: user.id, username: user.username, role: user.role },
  };
}
