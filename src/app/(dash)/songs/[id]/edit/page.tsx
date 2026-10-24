"use client";

import { useParams } from "next/navigation";
import { useApiJson } from "@/shared/use-api-json";
import { SongForm } from "@/features/songs/components/song-form";
import { BackButton } from "@/components/back-button";
import type { SongDto } from "@/features/songs/service";
import styles from "./edit.module.scss";

export default function EditSongPage() {
  const { id } = useParams<{ id: string }>();
  const { data: song, error } = useApiJson<SongDto>(`/api/v1/songs/${id}`);

  if (error && !song) return <p>歌曲不存在。</p>;
  if (!song)
    return (
      <div aria-busy="true">
        <div className="page-head">
          <div className={`page-title ${styles.skTitle}`} />
        </div>
        <div className={styles.skBlock} />
      </div>
    );
  return (
    <>
      <div className="page-head">
        <h1 className="page-title">编辑：{song.title}</h1>
        <BackButton />
      </div>
      <SongForm song={song} />
    </>
  );
}
