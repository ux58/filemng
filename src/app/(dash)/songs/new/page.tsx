import { SongForm } from "@/features/songs/components/song-form";
import { BackButton } from "@/components/back-button";

export default function NewSongPage() {
  return (
    <>
      <div className="page-head">
        <h1 className="page-title">上传歌曲</h1>
        <BackButton />
      </div>
      <SongForm />
    </>
  );
}
