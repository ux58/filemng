"use client";

import { create } from "zustand";
import type { SongDto } from "@/features/songs/service";

/** 底部播放条状态：单曲队列语义（点播即换曲） */
interface PlayerState {
  current: SongDto | null;
  play: (song: SongDto) => void;
  stop: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  current: null,
  play: (song) => set({ current: song }),
  stop: () => set({ current: null }),
}));
