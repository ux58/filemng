"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUpload } from "@/shared/api-client";
import { toast } from "@/stores/toast";
import { EMPTY_SONG_FORM, type SongCreateInput } from "@/features/songs/schema";
import { parseLyricsFile } from "@/features/songs/lyrics-import";
import type { SongDto } from "@/features/songs/service";
import styles from "./song-form.module.scss";

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

  const set = (k: keyof SongFormValue) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((prev) => ({ ...prev, [k]: e.target.value }));

  // 非负整数字段：仅放行数字，杜绝负号/小数点/科学计数法进入表单态
  const setNum = (k: keyof SongFormValue) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((prev) => ({ ...prev, [k]: e.target.value.replace(/\D/g, "").slice(0, 5) }));

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = song
        ? await apiUpload<SongDto>("PATCH", `/api/v1/songs/${song.id}`, toPayload(v), { audio, cover })
        : await apiUpload<SongDto>("POST", "/api/v1/songs", toPayload(v), { audio, cover });
      toast.ok(song ? "已保存" : "已创建");
      router.push(`/songs/${saved.id}`, { transitionTypes: ["nav-forward"] });
      router.refresh();
    } catch (err) {
      toast.err(err instanceof Error ? err.message : "保存失败");
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
            onChange={(e) => setAudio(e.target.files?.[0] ?? null)}
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
          {busy ? "保存中…" : song ? "保存修改" : "创建"}
        </button>
        <button type="button" className="btn" onClick={() => router.push(backTo, { transitionTypes: ["nav-back"] })}>
          取消
        </button>
      </div>
    </form>
  );
}
