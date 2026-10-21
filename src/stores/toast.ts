"use client";

import { create } from "zustand";

export interface Toast {
  id: number;
  kind: "ok" | "err";
  text: string;
}

interface ToastState {
  toasts: Toast[];
  push: (kind: Toast["kind"], text: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, text) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, kind, text }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** 命令式入口：非组件代码也可弹 toast */
export const toast = {
  ok: (text: string) => useToastStore.getState().push("ok", text),
  err: (text: string) => useToastStore.getState().push("err", text),
};
