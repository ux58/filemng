"use client";

import { useEffect, useRef } from "react";
import { SkipBack, SkipForward, X } from "lucide-react";
import { usePlayerStore } from "@/stores/player";
import { formatDuration } from "@/shared/format";
import styles from "./player-bar.module.scss";

export function PlayerBar() {
  const { current, next, prev, stop, queue, index } = usePlayerStore();
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    audioRef.current?.load();
  }, [current]);

  if (!current?.audio) return null;
  const hasPrev = index > 0;
  const hasNext = index < queue.length - 1;
  return (
    <div className={styles.bar}>
      {current.cover && <img className={styles.cover} src={current.cover.url} alt="" />}
      <div className={styles.meta}>
        <strong>{current.title}</strong>
        <span>{current.artist ?? "未知艺术家"}</span>
      </div>
      <button className={`btn ${styles.skip}`} onClick={prev} disabled={!hasPrev} aria-label="上一首">
        <SkipBack size={15} strokeWidth={2.2} />
      </button>
      <audio ref={audioRef} controls autoPlay src={current.audio.url} />
      <button className={`btn ${styles.skip}`} onClick={next} disabled={!hasNext} aria-label="下一首">
        <SkipForward size={15} strokeWidth={2.2} />
      </button>
      <span className={styles.dur}>{formatDuration(current.durationSec)}</span>
      <button className="btn" onClick={stop} aria-label="关闭播放器">
        <X size={15} strokeWidth={2.2} />
      </button>
    </div>
  );
}
