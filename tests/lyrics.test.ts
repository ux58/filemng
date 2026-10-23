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
