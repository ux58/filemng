"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiJsonBody } from "@/shared/api-client";
import { toast } from "@/stores/toast";
import styles from "./auth.module.scss";

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/songs";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiJsonBody("POST", "/api/auth/login", { username, password });
      router.replace(next);
    } catch (err) {
      toast.err(err instanceof Error ? err.message : "登录失败");
      setBusy(false);
    }
  }

  return (
    <main className={styles.wrap}>
      <form className={styles.card} onSubmit={submit}>
        <div className={styles.badge}>♫</div>
        <h1>欢迎回来</h1>
        <p className={styles.sub}>登录 FileMng 音乐库管理你的音乐</p>
        <div className="field">
          <label htmlFor="username">用户名</label>
          <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
        </div>
        <div className="field">
          <label htmlFor="password">密码</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn primary" disabled={busy}>
          {busy ? "登录中…" : "登录"}
        </button>
      </form>
    </main>
  );
}
