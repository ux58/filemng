/** 歌词文件解析：LRC 剥离时间轴/元数据标签，SRT/VTT 剥离序号与时间码，TXT 原样返回 */
export function parseLyricsFile(text: string, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  let parsed = text;
  if (ext === "lrc") {
    parsed = text
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*(?:\[[^\]]*\])+\s*/, "")) // 去行首 [mm:ss] 时间戳与 [ti:…] 等元数据
      .filter((line) => line.trim())
      .join("\n");
  } else if (ext === "srt" || ext === "vtt") {
    parsed = text
      .split(/\r?\n/)
      .filter((line) => !/^\s*\d+\s*$/.test(line) && !line.includes("-->") && !/^WEBVTT/i.test(line) && line.trim())
      .join("\n");
  }
  return parsed;
}
