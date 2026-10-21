"use client";

/** 浏览器端 API 封装：统一错误信封解析；401 时自动尝试一次刷新重放 */

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function parseError(res: Response): Promise<ApiClientError> {
  try {
    const body = await res.json();
    return new ApiClientError(res.status, body?.error?.code ?? "unknown", body?.error?.message ?? `HTTP ${res.status}`);
  } catch {
    return new ApiClientError(res.status, "unknown", `HTTP ${res.status}`);
  }
}

async function request(path: string, init?: RequestInit, retried = false): Promise<Response> {
  const res = await fetch(path, init);
  if (res.status === 401 && !retried && !path.startsWith("/api/auth/")) {
    const refreshed = await fetch("/api/auth/refresh", { method: "POST" });
    if (refreshed.ok) return request(path, init, true);
  }
  return res;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await request(path, init);
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function apiJsonBody<T>(method: string, path: string, data: unknown): Promise<T> {
  return apiJson<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/** multipart 上传：payload JSON + 可选 audio/cover 文件 */
export async function apiUpload<T>(method: string, path: string, payload: unknown, files: { audio?: File | null; cover?: File | null }): Promise<T> {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  if (files.audio) form.append("audio", files.audio);
  if (files.cover) form.append("cover", files.cover);
  return apiJson<T>(path, { method, body: form });
}
