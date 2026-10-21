import { describe, expect, it } from "vitest";
import { hashPassword, isValidPassword, verifyPassword } from "@/server/security/password";

describe("password", () => {
  it("bcrypt 哈希可验证", async () => {
    const hash = await hashPassword("abc12345");
    expect(hash).not.toContain("abc12345");
    expect(await verifyPassword("abc12345", hash)).toBe(true);
    expect(await verifyPassword("wrong123", hash)).toBe(false);
  });

  it("密码策略：8-72 位且含字母数字", () => {
    expect(isValidPassword("abc12345")).toBe(true);
    expect(isValidPassword("short1a")).toBe(false); // 7 位
    expect(isValidPassword("nodigitshere")).toBe(false);
    expect(isValidPassword("12345678")).toBe(false); // 无字母
    expect(isValidPassword("a".repeat(73) + "1")).toBe(false);
  });
});
