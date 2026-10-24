"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUpload, apiJson, apiJsonBody } from "@/shared/api-client";
import { clearApiCache } from "@/shared/use-api-json";
import { toast } from "@/stores/toast";
import { EMPTY_SONG_FORM, type SongCreateInput } from "@/features/songs/schema";
import { parseLyricsFile } from "@/features/songs/lyrics-import";
import type { SongDto } from "@/features/songs/service";
import styles from "./song-form.module.scss";

/** 扩展名兜底 MIME 推断（浏览器 file.type 可能为空或过泛） */
function guessMime(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav", flac: "audio/flac", m4a: "audio/mp4",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif",
  };
  return (ext && map[ext]) || "application/octet-stream";
}

/** 表单态：所有字段均为字符串（数值/可空语义在提交时收敛） */
type SongFormValue = Record<
  "title" | "artist" | "album" | "genre" | "year" | "durationSec" | "trackNo" | "description" | "lyrics",
  string
>;

function toFormValue(dto?: SongDto): SongFormValue {
  const s: Partial<SongDto> = dto ?? EMPTY_SONG_FORM;
  return {
    title: s.title ?? "",
    artist: s.artist ?? "",
    album: s.album ?? "",
    genre: s.genre ?? "",
    year: s.year != null ? String(s.year) : "",
    durationSec: s.durationSec != null ? String(s.durationSec) : "",
    trackNo: s.trackNo != null ? String(s.trackNo) : "",
    description: s.description ?? "",
    lyrics: s.lyrics ?? "",
  };
}

/** 数值/空串收敛为 null 后提交 */
function toPayload(v: SongFormValue): SongCreateInput {
  const num = (s: string) => (s === "" ? null : Number(s));
  const txt = (s: string) => (s === "" ? null : s);
  return {
    title: v.title,
    artist: txt(v.artist),
    album: txt(v.album),
    genre: txt(v.genre),
    year: num(v.year),
    durationSec: num(v.durationSec),
    trackNo: num(v.trackNo),
    description: txt(v.description),
    lyrics: txt(v.lyrics),
  };
}

export function SongForm({ song, cancelTo }: { song?: SongDto; cancelTo?: string }) {
  const router = useRouter();
  const backTo = cancelTo ?? (song ? `/songs/${song.id}` : "/songs");
  const [v, setV] = useState<SongFormValue>(() => toFormValue(song));
  const [audio, setAudio] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [directUpload, setDirectUpload] = useState(false); // S3 后端：文件直传对象存储，绕过 Serverless 请求体上限

  useEffect(() => {
    apiJson<{ directUpload: boolean }>("/api/v1/storage-mode")
      .then((r) => setDirectUpload(r.directUpload))
      .catch(() => setDirectUpload(false));
  }, []);

  const set = (k: keyof SongFormValue) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((prev) => ({ ...prev, [k]: e.target.value }));

  // 非负整数字段：仅放行数字，杜绝负号/小数点/科学计数法进入表单态
  const setNum = (k: keyof SongFormValue) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((prev) => ({ ...prev, [k]: e.target.value.replace(/\D/g, "").slice(0, 5) }));

  // 选择音频且时长为空时，用 <audio> 元数据免费回填时长（直传通道服务端不解析 ID3）
  function onAudioChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setAudio(file);
    if (file && !v.durationSec) {
      const url = URL.createObjectURL(file);
      const probe = new Audio();
      probe.preload = "metadata";
      probe.src = url;
      probe.onloadedmetadata = () => {
        if (Number.isFinite(probe.duration) && probe.duration > 0) {
          setV((prev) => (prev.durationSec ? prev : { ...prev, durationSec: String(Math.round(probe.duration)) }));
        }
        URL.revokeObjectURL(url);
      };
    }
  }

  /** 歌词文件导入：LRC/SRT/VTT 自动剥离时间轴与序号，TXT 原样导入 */
  async function importLyrics(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 允许重复选择同一文件
    if (!file) return;
    if (file.size > 512 * 1024) {
      toast.err("歌词文件过大（限 512KB）");
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseLyricsFile(text, file.name);
      if (!parsed.trim()) {
        toast.err("未能从文件中解析出歌词内容");
        return;
      }
      setV((prev) => ({ ...prev, lyrics: parsed }));
      toast.ok(`已导入歌词：${file.name}`);
    } catch {
      toast.err("歌词文件读取失败");
    }
  }

  /** 直传：签发 URL → PUT 到对象存储 → 返回复合键引用 */
  async function uploadDirect(kind: "audio" | "cover", file: File): Promise<{ key: string; name: string }> {
    const mime = guessMime(file);
    const signed = await apiJsonBody<{ url: string; key: string }>("POST", "/api/v1/songs/upload-url", {
      kind,
      mime,
      filename: file.name,
      size: file.size,
    });
    const res = await fetch(signed.url, { method: "PUT", body: file, headers: { "Content-Type": mime } });
    if (!res.ok) throw new Error(`${kind === "audio" ? "音频" : "封面"}直传失败（HTTP ${res.status}）`);
    return { key: signed.key, name: file.name.slice(0, 200) };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await (async () => {
        if (directUpload && (audio || cover)) {
          setStage("上传文件中…");
          const [a, c] = [
            audio ? await uploadDirect("audio", audio) : undefined,
            cover ? await uploadDirect("cover", cover) : undefined,
          ];
          setStage("保存中…");
          const body = { ...toPayload(v), ...(a && { audioUpload: a }), ...(c && { coverUpload: c }) };
          return song
            ? await apiJsonBody<SongDto>("PATCH", `/api/v1/songs/${song.id}`, body)
            : await apiJsonBody<SongDto>("POST", "/api/v1/songs", body);
        }
        return song
          ? await apiUpload<SongDto>("PATCH", `/api/v1/songs/${song.id}`, toPayload(v), { audio, cover })
          : await apiUpload<SongDto>("POST", "/api/v1/songs", toPayload(v), { audio, cover });
      })();
      toast.ok(song ? "已保存" : "已创建");
      clearApiCache();
      router.push(`/songs/${saved.id}`, { transitionTypes: ["nav-forward"] });
      router.refresh();
    } catch (err) {
      toast.err(err instanceof Error ? err.message : "保存失败");
      setStage("");
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.grid}>
        <div className="field">
          <label htmlFor="f-title">标题 *</label>
          <input id="f-title" value={v.title} onChange={set("title")} required maxLength={200} />
        </div>
        <div className="field">
          <label htmlFor="f-artist">艺术家</label>
          <input id="f-artist" value={v.artist} onChange={set("artist")} maxLength={200} />
        </div>
        <div className="field">
          <label htmlFor="f-album">专辑</label>
          <input id="f-album" value={v.album} onChange={set("album")} maxLength={200} />
        </div>
        <div className="field">
          <label htmlFor="f-genre">流派</label>
          <input id="f-genre" value={v.genre} onChange={set("genre")} maxLength={100} />
        </div>
        <div className="field">
          <label htmlFor="f-year">年份</label>
          <input id="f-year" type="number" inputMode="numeric" min={1000} max={3000} value={v.year} onChange={setNum("year")} />
        </div>
        <div className="field">
          <label htmlFor="f-track">音轨号</label>
          <input id="f-track" type="number" inputMode="numeric" min={0} max={999} value={v.trackNo} onChange={setNum("trackNo")} />
        </div>
        <div className="field">
          <label htmlFor="f-dur">时长（秒，上传音频后可自动解析）</label>
          <input id="f-dur" type="number" inputMode="numeric" min={0} max={86400} value={v.durationSec} onChange={setNum("durationSec")} />
        </div>
        <div className="field">
          <label htmlFor="f-audio">音频文件（mp3/ogg/wav/flac/m4a）</label>
          <input
            id="f-audio"
            type="file"
            accept=".mp3,.ogg,.wav,.flac,.m4a,audio/*"
            onChange={onAudioChange}
          />
        </div>
        <div className="field">
          <label htmlFor="f-cover">封面图片（jpg/png/webp/gif/avif）</label>
          <input
            id="f-cover"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.gif,.avif,image/*"
            onChange={(e) => setCover(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="f-desc">描述</label>
        <textarea id="f-desc" value={v.description} onChange={set("description")} maxLength={2000} />
      </div>
      <div className="field">
        <label htmlFor="f-lyrics">歌词</label>
        <textarea id="f-lyrics" rows={10} value={v.lyrics} onChange={set("lyrics")} />
      </div>
      <div className="field">
        <label htmlFor="f-lyrics-file">歌词文件导入（支持 .lrc / .srt / .vtt / .txt，自动去除时间轴，导入后可编辑）</label>
        <input id="f-lyrics-file" type="file" accept=".lrc,.srt,.vtt,.txt,text/plain" onChange={importLyrics} />
      </div>
      <div className={styles.actions}>
        <button className="btn primary" disabled={busy}>
          {busy ? stage || "保存中…" : song ? "保存修改" : "创建"}
        </button>
        <button type="button" className="btn" onClick={() => router.push(backTo, { transitionTypes: ["nav-back"] })}>
          取消
        </button>
      </div>
    </form>
  );
}
