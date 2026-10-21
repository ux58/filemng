"use client";

import { create } from "zustand";
import type { SongDto } from "@/features/songs/service";

/** 底部播放条状态：队列语义。列表页播放时带入完整队列，支持上一首/下一首 */
interface PlayerState {
  queue: SongDto[];
  index: number;
  current: SongDto | null;
  /** 播放单曲；提供 list 时以该列表为播放队列 */
  play: (song: SongDto, list?: SongDto[]) => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  index: -1,
  current: null,
  play: (song, list) => {
    const queue = list?.length ? list : [song];
    const index = Math.max(0, queue.findIndex((s) => s.id === song.id));
    set({ queue, index, current: queue[index] ?? song });
  },
  next: () => {
    const { queue, index } = get();
    if (index < queue.length - 1) set({ index: index + 1, current: queue[index + 1]! });
  },
  prev: () => {
    const { queue, index } = get();
    if (index > 0) set({ index: index - 1, current: queue[index - 1]! });
  },
  stop: () => set({ queue: [], index: -1, current: null }),
}));
