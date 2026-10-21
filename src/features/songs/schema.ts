import { z } from "zod";

/** 前后端共享校验：strict 模式拒绝未知字段 */

const nullableText = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().trim().max(max).nullable(),
  );
const nullableInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.number().int().min(min).max(max).nullable(),
  );

export const songCreateSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  artist: nullableText(200),
  album: nullableText(200),
  genre: nullableText(100),
  year: nullableInt(1000, 3000),
  durationSec: nullableInt(0, 86400),
  trackNo: nullableInt(0, 999),
  description: nullableText(2000),
  lyrics: nullableText(100_000),
});

export const songUpdateSchema = songCreateSchema.partial();

export const songQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(200).optional(),
  genre: z.string().trim().max(100).optional(),
  year: z.coerce.number().int().min(1000).max(3000).optional(),
});

export type SongCreateInput = z.infer<typeof songCreateSchema>;
export type SongUpdateInput = z.infer<typeof songUpdateSchema>;
export type SongQuery = z.infer<typeof songQuerySchema>;

/** 供 UI 使用的空表单默认值 */
export const EMPTY_SONG_FORM: SongCreateInput = {
  title: "",
  artist: null,
  album: null,
  genre: null,
  year: null,
  durationSec: null,
  trackNo: null,
  description: null,
  lyrics: null,
};
