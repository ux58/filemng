"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiJson } from "@/shared/api-client";
import { SongForm } from "@/features/songs/components/song-form";
import { BackButton } from "@/components/back-button";
import type { SongDto } from "@/features/songs/service";

export default function EditSongPage() {
  const { id } = useParams<{ id: string }>();
  const [song, setSong] = useState<SongDto | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    apiJson<SongDto>(`/api/v1/songs/${id}`)
      .then(setSong)
      .catch(() => setMissing(true));
  }, [id]);

  if (missing) return <p>歌曲不存在。</p>;
  if (!song) return null;
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
