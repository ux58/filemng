"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson, apiJsonBody } from "@/shared/api-client";
import { toast } from "@/stores/toast";
import { Music2 } from "lucide-react";
import styles from "../login/auth.module.scss";

/** 首次运行引导：仅当系统中无任何用户时可创建管理员 */
export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiJson<{ initialized: boolean }>("/api/auth/setup")
      .then((r) => setInitialized(r.initialized))
      .catch(() => setInitialized(true))
      .finally(() => setChecking(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.err("两次输入的密码不一致");
      return;
    }
    setBusy(true);
    try {
      await apiJsonBody("POST", "/api/auth/setup", { username, password });
      toast.ok("管理员创建成功");
      router.replace("/songs");
    } catch (err) {
      toast.err(err instanceof Error ? err.message : "初始化失败");
      setBusy(false);
    }
  }

  if (checking) return <main className={styles.wrap} />;
  if (initialized) {
    return (
      <main className={styles.wrap}>
        <div className={styles.card}>
          <h1>已初始化</h1>
          <p className={styles.hint}>管理员已存在，请直接登录。</p>
          <a className="btn primary" href="/login" style={{ display: "block", textAlign: "center" }}>
            去登录
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.wrap}>
      <form className={styles.card} onSubmit={submit}>
        <div className={styles.badge}><Music2 size={24} strokeWidth={2.2} /></div>
        <h1>初始化管理员</h1>
        <p className={styles.hint}>首次运行：创建管理员账号后即可开始管理音乐库。</p>
        <div className="field">
          <label htmlFor="username">用户名（≥3 位）</label>
          <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} autoFocus required />
        </div>
        <div className="field">
          <label htmlFor="password">密码（≥8 位，含字母与数字）</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="confirm">确认密码</label>
          <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        <button className="btn primary" disabled={busy}>
          {busy ? "创建中…" : "创建并登录"}
        </button>
      </form>
    </main>
  );
}
