import { describe, expect, it } from "vitest";
import { parseLyricsFile } from "../src/features/songs/lyrics-import";

describe("parseLyricsFile", () => {
  it("LRC：剥离时间戳与元数据标签，保留纯文本行", () => {
    const lrc = "[ti:测试]\n[00:12.00]第一行歌词\n[00:20.50][01:05.30]重复标记行\n\n[01:30.00]最后一行";
    expect(parseLyricsFile(lrc, "song.lrc")).toBe("第一行歌词\n重复标记行\n最后一行");
  });

  it("SRT：剥离序号行与时间码行", () => {
    const srt = "1\n00:00:01,000 --> 00:00:04,000\nHello world\n\n2\n00:00:05,000 --> 00:00:08,000\nSecond line";
    expect(parseLyricsFile(srt, "song.srt")).toBe("Hello world\nSecond line");
  });

  it("VTT：剥离 WEBVTT 头与时间码", () => {
    const vtt = "WEBVTT\n\n00:01.000 --> 00:04.000\n副歌部分";
    expect(parseLyricsFile(vtt, "song.vtt")).toBe("副歌部分");
  });

  it("TXT：原样保留", () => {
    expect(parseLyricsFile("第一段\n\n第二段", "lyrics.txt")).toBe("第一段\n\n第二段");
  });

  it("未知扩展名按原样返回", () => {
    expect(parseLyricsFile("[00:01.00]keep", "notes.md")).toBe("[00:01.00]keep");
  });

  it("CRLF 换行正常处理", () => {
    expect(parseLyricsFile("[00:01.00]行一\r\n[00:02.00]行二", "song.lrc")).toBe("行一\n行二");
  });
});

import { songCreateSchema, uploadUrlSchema } from "../src/features/songs/schema";

describe("direct upload schema", () => {
  it("接受合法直传引用", () => {
    const parsed = songCreateSchema.parse({ title: "T", audioUpload: { key: "s3:audio/abcd1234.mp3", name: "song.mp3" } });
    expect(parsed.audioUpload?.key).toBe("s3:audio/abcd1234.mp3");
  });

  it("拒绝非法键（错误驱动前缀/路径穿越）", () => {
    expect(() => songCreateSchema.parse({ title: "T", audioUpload: { key: "local:audio/x.mp3", name: "a" } })).toThrow();
    expect(() => songCreateSchema.parse({ title: "T", audioUpload: { key: "s3:../etc/passwd", name: "a" } })).toThrow();
  });

  it("multipart payload 不允许携带直传字段", () => {
    expect(() =>
      songMultipartPayloadSchema.parse({ title: "T", audioUpload: { key: "s3:audio/a.mp3", name: "a" } }),
    ).toThrow();
  });

  it("upload-url 请求校验", () => {
    expect(uploadUrlSchema.parse({ kind: "audio", mime: "audio/mpeg", filename: "a.mp3", size: 100 }).kind).toBe("audio");
    expect(() => uploadUrlSchema.parse({ kind: "video", mime: "audio/mpeg", filename: "a.mp3", size: 100 })).toThrow();
  });
});
