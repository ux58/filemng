"use client";

import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/stores/player";
import { formatDuration } from "@/shared/format";
import styles from "./player-bar.module.scss";

export function PlayerBar() {
  const current = usePlayerStore((s) => s.current);
  const stop = usePlayerStore((s) => s.stop);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    audioRef.current?.load();
  }, [current]);

  if (!current?.audio) return null;
  return (
    <div className={styles.bar}>
      {current.cover && <img className={styles.cover} src={current.cover.url} alt="" />}
      <div className={styles.meta}>
        <strong>{current.title}</strong>
        <span>{current.artist ?? "未知艺术家"}</span>
      </div>
      <audio ref={audioRef} controls autoPlay src={current.audio.url} />
      <span className={styles.dur}>{formatDuration(current.durationSec)}</span>
      <button className="btn" onClick={stop} aria-label="关闭播放器">
        ✕
      </button>
    </div>
  );
}
