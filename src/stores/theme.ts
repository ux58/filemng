"use client";

import { create } from "zustand";

export type Theme = "dark" | "light";

interface ThemeState {
  theme: Theme;
  /** 初始化：从 localStorage 恢复（与 layout 无闪烁脚本同键），默认暗色 */
  init: () => void;
  toggle: () => void;
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

const STORAGE_KEY = "fmm-theme";

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "dark",
  init: () => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "dark";
    apply(stored);
    set({ theme: stored });
  },
  toggle: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    // 切换瞬间禁用全站过渡：颜色立即生效，避免大面积重绘的卡顿感
    root.classList.add("theme-switching");
    localStorage.setItem(STORAGE_KEY, next);
    apply(next);
    set({ theme: next });
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
  },
}));
