import bcrypt from "bcryptjs";

const ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** 密码策略：8-72 字符，至少一字母一数字 */
export function isValidPassword(pw: string): boolean {
  return pw.length >= 8 && pw.length <= 72 && /[a-zA-Z]/.test(pw) && /\d/.test(pw);
}
