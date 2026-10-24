import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";
import type { StorageAdapter, StorageRange, StoredObject } from "./types";

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** S3 兼容适配器：AWS S3 / MinIO / Cloudflare R2 / 阿里 OSS / 腾讯 COS */
export class S3Storage implements StorageAdapter {
  readonly driver = "s3" as const;
  private readonly client: S3Client;

  constructor(private readonly cfg: S3Config) {
    this.client = new S3Client({
      region: cfg.region || "us-east-1",
      endpoint: cfg.endpoint || undefined,
      forcePathStyle: Boolean(cfg.endpoint), // MinIO/R2/OSS 兼容端点需 path-style
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
  }

  async put(key: string, data: Uint8Array, mime: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, Body: data, ContentType: mime }),
    );
  }

  async get(key: string, range?: StorageRange): Promise<StoredObject | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({
          Bucket: this.cfg.bucket,
          Key: key,
          Range: range ? `bytes=${range.start}-${range.end}` : undefined,
        }),
      );
      if (!res.Body) return null;
      const stream = toWebStream(res.Body as unknown);
      const total = parseTotal(res.ContentRange, res.ContentLength);
      const len = range ? Number(res.ContentLength ?? range.end - range.start + 1) : Number(res.ContentLength ?? 0);
      return { stream, size: len, total };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
  }

  async test(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.cfg.bucket }));
  }

  async presignPut(path: string, mime: string, expiresInSec: number): Promise<string> {
    const cmd = new PutObjectCommand({ Bucket: this.cfg.bucket, Key: path, ContentType: mime });
    return getSignedUrl(this.client, cmd, { expiresIn: expiresInSec });
  }

  async head(path: string): Promise<{ size: number; contentType: string } | null> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.cfg.bucket, Key: path }));
      return { size: Number(res.ContentLength ?? 0), contentType: res.ContentType ?? "" };
    } catch {
      return null;
    }
  }
}

/** 从 Content-Range（"bytes 0-99/1234"）提取全量大小 */
function parseTotal(contentRange?: string, contentLength?: number): number | undefined {
  if (contentRange) {
    const m = /\/(\d+)$/.exec(contentRange);
    if (m) return Number(m[1]);
  }
  return contentLength;
}

/** smithy 流载荷在不同运行时形态不一，统一收敛为 Web ReadableStream */
function toWebStream(body: unknown): ReadableStream<Uint8Array> {
  if (body instanceof ReadableStream) return body as ReadableStream<Uint8Array>;
  if (body instanceof Readable) return Readable.toWeb(body) as ReadableStream<Uint8Array>;
  if (body && typeof (body as { transformToWebStream?: unknown }).transformToWebStream === "function") {
    return (body as { transformToWebStream: () => ReadableStream<Uint8Array> }).transformToWebStream();
  }
  throw new Error("无法识别的 S3 响应流形态");
}
