import { describe, expect, it } from "vitest";
import { sniffMime } from "@/server/security/magic-bytes";

const MP3_FRAME = new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
const ID3 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]); // "ID3" + v2.4 头
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a
const utf8 = (s: string) => new TextEncoder().encode(s);

describe("magic-bytes（魔数嗅探）", () => {
  it("识别白名单内音频", () => {
    expect(sniffMime(MP3_FRAME, "audio")).toBe("audio/mpeg");
    expect(sniffMime(ID3, "audio")).toBe("audio/mpeg");
    expect(sniffMime(utf8("OggS...."), "audio")).toBe("audio/ogg");
    expect(sniffMime(utf8("fLaC...."), "audio")).toBe("audio/flac");
  });

  it("识别白名单内图片", () => {
    expect(sniffMime(JPEG, "image")).toBe("image/jpeg");
    expect(sniffMime(PNG, "image")).toBe("image/png");
    expect(sniffMime(GIF, "image")).toBe("image/gif");
  });

  it("种类错位 / 未知魔数 / 伪造扩展名一律拒绝", () => {
    expect(sniffMime(JPEG, "audio")).toBeNull(); // 图片冒充音频
    expect(sniffMime(MP3_FRAME, "image")).toBeNull();
    expect(sniffMime(utf8("<html>"), "image")).toBeNull(); // 伪装 HTML
    expect(sniffMime(utf8("<?php"), "audio")).toBeNull();
    expect(sniffMime(new Uint8Array(8), "audio")).toBeNull();
  });

  it("MP4 家族按 brand 区分音频与 avif", () => {
    expect(sniffMime(utf8("....ftypM4A ...."), "audio")).toBe("audio/mp4");
    expect(sniffMime(utf8("....ftypavif...."), "image")).toBe("image/avif");
    expect(sniffMime(utf8("....ftypavif...."), "audio")).toBeNull();
  });
});
