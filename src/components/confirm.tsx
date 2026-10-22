"use client";

import { useEffect } from "react";
import { create } from "zustand";
import styles from "./confirm.module.scss";

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  danger: boolean;
  resolve: ((ok: boolean) => void) | null;
}

const useConfirmStore = create<ConfirmState>(() => ({
  open: false,
  title: "",
  message: "",
  danger: false,
  resolve: null,
}));

/** Promise 风格确认弹窗：await confirmDialog({ title, message }) */
export function confirmDialog(opts: { title: string; message?: string; danger?: boolean }): Promise<boolean> {
  const { resolve } = useConfirmStore.getState();
  resolve?.(false); // 上一个未决交互按取消处理
  return new Promise<boolean>((res) => {
    useConfirmStore.setState({ open: true, ...opts, danger: opts.danger ?? false, resolve: res });
  });
}

export function ConfirmHost() {
  const { open, title, message, danger, resolve } = useConfirmStore();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const { resolve: r } = useConfirmStore.getState();
        r?.(false);
        useConfirmStore.setState({ open: false, resolve: null });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (!open) return null;

  const done = (ok: boolean) => {
    resolve?.(ok);
    useConfirmStore.setState({ open: false, resolve: null });
  };

  return (
    <div className={styles.mask} onClick={() => done(false)}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-label={title}>
        <h2 className={danger ? styles.dangerTitle : ""}>{title}</h2>
        {message && <p>{message}</p>}
        <div className={styles.actions}>
          <button className="btn" onClick={() => done(false)}>
            取消
          </button>
          <button className={`btn ${danger ? "danger" : "primary"}`} onClick={() => done(true)}>
            确认
          </button>
        </div>
      </div>
    </div>
  );
}
