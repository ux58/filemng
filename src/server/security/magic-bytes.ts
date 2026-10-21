import { AUDIO_MIMES, IMAGE_MIMES } from "@/shared/constants";

/**
 * 魔数嗅探：不信任扩展名与 Content-Type，以文件头字节判定真实类型。
 * 返回白名单内的 MIME；无法识别返回 null。
 */
export function sniffMime(head: Uint8Array, kind: "audio" | "image"): string | null {
  const detected = detect(head);
  const whitelist = kind === "audio" ? AUDIO_MIMES : IMAGE_MIMES;
  return detected && (whitelist as readonly string[]).includes(detected) ? detected : null;
}

function detect(b: Uint8Array): string | null {
  const ascii = (i: number, n: number) => String.fromCharCode(...b.slice(i, i + n));

  if (b[0] === 0xff && (b[1]! & 0xe0) === 0xe0) return "audio/mpeg"; // MP3 帧
  if (ascii(0, 3) === "ID3") return "audio/mpeg"; // MP3 + ID3v2
  if (ascii(0, 4) === "OggS") return "audio/ogg";
  if (ascii(0, 4) === "fLaC") return "audio/flac";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") return "audio/wav";
  if (ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4);
    if (brand.startsWith("M4A") || brand.startsWith("iso2") || brand.startsWith("isom") || brand === "dash")
      return "audio/mp4";
    if (brand.startsWith("avif") || brand === "avis") return "image/avif";
    return null;
  }
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (ascii(0, 8) === "\x89PNG\r\n\x1a\n") return "image/png";
  if (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a") return "image/gif";
  return null;
}
