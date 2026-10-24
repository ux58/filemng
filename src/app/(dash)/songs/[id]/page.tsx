"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useApiJson } from "@/shared/use-api-json";
import { formatBytes, formatDateTime, formatDuration } from "@/shared/format";
import { Play } from "lucide-react";
import { usePlayerStore } from "@/stores/player";
import { BackButton } from "@/components/back-button";
import type { SongDto } from "@/features/songs/service";
import styles from "./detail.module.scss";

export default function SongDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: song, error } = useApiJson<SongDto>(`/api/v1/songs/${id}`);
  const play = usePlayerStore((s) => s.play);

  if (error && !song) return <p>歌曲不存在。</p>;
  if (!song)
    return (
      <div className={styles.detail} aria-busy="true">
        <div className={styles.head}>
          <div className={`${styles.cover} ${styles.skPulse}`} />
          <div className={styles.skLines}>
            <div className={`${styles.skLine} ${styles.skW55}`} />
            <div className={`${styles.skLine} ${styles.skW35}`} />
          </div>
        </div>
      </div>
    );

  return (
    <div className={styles.detail}>
      <header className={styles.head}>
        {song.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.cover} src={song.cover.url} alt={song.title} />
        ) : (
          <div className={`${styles.cover} ${styles.ph}`} />
        )}
        <div>
          <h1 className="page-title">{song.title}</h1>
          <p className={styles.sub}>
            {song.artist ?? "未知艺术家"}
            {song.album && ` · 《${song.album}》`}
            {song.year && ` · ${song.year}`}
            {song.genre && ` · ${song.genre}`}
          </p>
          <div className={styles.actions}>
            {song.audio && (
              <button className="btn primary" onClick={() => play(song)}>
                <Play size={14} strokeWidth={2.4} style={{marginRight:6}} />播放
              </button>
            )}
            <Link className="btn" href={`/songs/${song.id}/edit`} transitionTypes={["nav-forward"]}>
              编辑
            </Link>
            <BackButton />
          </div>
        </div>
      </header>

      <section className={styles.meta}>
        <div>
          <span>时长</span>
          {formatDuration(song.durationSec)}
        </div>
        <div>
          <span>音轨号</span>
          {song.trackNo ?? "-"}
        </div>
        <div>
          <span>音频</span>
          {song.audio ? `${song.audio.name}（${formatBytes(song.audio.size)}）` : "未上传"}
        </div>
        <div>
          <span>封面</span>
          {song.cover ? `${song.cover.name}（${formatBytes(song.cover.size)}）` : "未上传"}
        </div>
        <div>
          <span>创建时间</span>
          {formatDateTime(song.createdAt)}
        </div>
        <div>
          <span>更新时间</span>
          {formatDateTime(song.updatedAt)}
        </div>
      </section>

      {song.description && (
        <section className={styles.section}>
          <h2>描述</h2>
          <p>{song.description}</p>
        </section>
      )}

      <section className={styles.section}>
        <h2>歌词</h2>
        {song.lyrics ? (
          <pre className={styles.lyrics}>{song.lyrics}</pre>
        ) : (
          <p className={styles.dim}>暂无歌词</p>
        )}
      </section>
    </div>
  );
}
