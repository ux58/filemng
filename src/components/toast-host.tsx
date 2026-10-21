"use client";

import { useToastStore } from "@/stores/toast";
import styles from "./toast-host.module.scss";

export function ToastHost() {
  const { toasts, dismiss } = useToastStore();
  if (toasts.length === 0) return null;
  return (
    <div className={styles.host}>
      {toasts.map((t) => (
        <button key={t.id} className={`${styles.toast} ${t.kind === "ok" ? styles.ok : styles.err}`} onClick={() => dismiss(t.id)}>
          {t.text}
        </button>
      ))}
    </div>
  );
}
