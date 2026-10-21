"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUpload } from "@/shared/api-client";
import { toast } from "@/stores/toast";
import { EMPTY_SONG_FORM, type SongCreateInput } from "@/features/songs/schema";
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

export function SongForm({ song }: { song?: SongDto }) {
  const router = useRouter();
  const [v, setV] = useState<SongFormValue>(() => toFormValue(song));
  const [audio, setAudio] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof SongFormValue) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((prev) => ({ ...prev, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = song
        ? await apiUpload<SongDto>("PATCH", `/api/v1/songs/${song.id}`, toPayload(v), { audio, cover })
        : await apiUpload<SongDto>("POST", "/api/v1/songs", toPayload(v), { audio, cover });
      toast.ok(song ? "已保存" : "已创建");
      router.push(`/songs/${saved.id}`);
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
          <input id="f-year" type="number" min={1000} max={3000} value={v.year} onChange={set("year")} />
        </div>
        <div className="field">
          <label htmlFor="f-track">音轨号</label>
          <input id="f-track" type="number" min={0} max={999} value={v.trackNo} onChange={set("trackNo")} />
        </div>
        <div className="field">
          <label htmlFor="f-dur">时长（秒，上传音频后可自动解析）</label>
          <input id="f-dur" type="number" min={0} max={86400} value={v.durationSec} onChange={set("durationSec")} />
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
      <div className={styles.actions}>
        <button className="btn primary" disabled={busy}>
          {busy ? "保存中…" : song ? "保存修改" : "创建"}
        </button>
        <button type="button" className="btn" onClick={() => router.back()}>
          取消
        </button>
      </div>
    </form>
  );
}
