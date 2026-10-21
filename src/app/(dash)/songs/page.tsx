import { Suspense } from "react";
import { SongList } from "./list";

export default function SongsPage() {
  return (
    <Suspense>
      <SongList />
    </Suspense>
  );
}
