import { COOKIE_ACCESS, COOKIE_REFRESH, ACCESS_TOKEN_TTL_SEC, REFRESH_TOKEN_TTL_SEC } from "@/shared/constants";
import { env } from "@/server/env";

export function accessCookie(token: string) {
  return {
    name: COOKIE_ACCESS,
    value: token,
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SEC,
  };
}

export function refreshCookie(token: string) {
  return {
    name: COOKIE_REFRESH,
    value: token,
    httpOnly: true,
    secure: env.isProd,
    sameSite: "strict" as const,
    path: "/api/auth", // 仅鉴权端点可见，缩小暴露面
    maxAge: REFRESH_TOKEN_TTL_SEC,
  };
}

export const clearedCookies = [
  { ...accessCookie(""), maxAge: 0 },
  { ...refreshCookie(""), maxAge: 0 },
];
