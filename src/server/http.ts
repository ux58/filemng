import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ERROR_CODES, type ErrorCode } from "@/shared/constants";

/** 统一 API 错误：携带状态码/错误码/可选响应头，由 errorResponse 收敛为标准信封 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly headers?: Record<string, string>,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function jsonError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status, headers: err.headers },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: ERROR_CODES.VALIDATION, message: "参数校验失败", details: err.issues } },
      { status: 422 },
    );
  }
  console.error("[api] 未捕获异常:", err);
  return NextResponse.json(
    { error: { code: ERROR_CODES.INTERNAL, message: "服务器内部错误" } },
    { status: 500 },
  );
}
