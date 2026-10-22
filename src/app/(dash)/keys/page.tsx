"use client";

import { useEffect, useState } from "react";
import { apiJson, apiJsonBody } from "@/shared/api-client";
import { formatDateTime } from "@/shared/format";
import { SCOPES } from "@/shared/constants";
import { confirmDialog } from "@/components/confirm";
import { toast } from "@/stores/toast";
import { KeyRound } from "lucide-react";
import styles from "./page.module.scss";

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  allowedDomains: string[];
  rateLimit: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export default function KeysPage() {
  const [items, setItems] = useState<ApiKeyItem[]>([]);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["songs:read"]);
  const [rateLimit, setRateLimit] = useState("60");
  const [expiresAt, setExpiresAt] = useState("");
  const [domains, setDomains] = useState("");
  const [created, setCreated] = useState<{ name: string; key: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiJson<{ items: ApiKeyItem[] }>("/api/keys")
      .then((r) => setItems(r.items))
      .catch((e) => toast.err(e.message));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiJsonBody<ApiKeyItem & { key: string }>("POST", "/api/keys", {
        name,
        scopes,
        rateLimit: Number(rateLimit) || 60,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        allowedDomains: domains
          .split(/[,\s]+/)
          .map((d) => d.trim())
          .filter(Boolean),
      });
      setCreated({ name: res.name, key: res.key });
      setName("");
      setExpiresAt("");
      setDomains("");
      const r = await apiJson<{ items: ApiKeyItem[] }>("/api/keys");
      setItems(r.items);
    } catch (err) {
      toast.err(err instanceof Error ? err.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string, name: string) {
    if (!(await confirmDialog({ title: `吊销「${name}」？`, message: "使用该 Key 的外部调用将立即失效。", danger: true }))) return;
    try {
      await apiJson(`/api/keys/${id}`, { method: "DELETE" });
      setItems((prev) => prev.map((k) => (k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k)));
      toast.ok("已吊销");
    } catch (e) {
      toast.err(e instanceof Error ? e.message : "吊销失败");
    }
  }

  function copyKey() {
    if (created) navigator.clipboard.writeText(created.key).then(() => toast.ok("已复制到剪贴板"));
  }

  return (
    <>
      <h1 className="page-title">API Keys</h1>
      <p className={styles.intro}>
        供外部系统调用开放 API：请求头携带 <code>X-API-Key</code>。明文仅在创建时展示一次，服务端只存哈希。
      </p>

      <form className={styles.create} onSubmit={create}>
        <div className="field">
          <label htmlFor="k-name">名称 *</label>
          <input id="k-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：移动端 App" required maxLength={100} />
        </div>
        <div className="field">
          <label>权限范围 *</label>
          <div className={styles.scopes}>
            {SCOPES.map((s) => (
              <label key={s} className={styles.scope}>
                <input
                  type="checkbox"
                  checked={scopes.includes(s)}
                  onChange={(e) =>
                    setScopes((prev) => (e.target.checked ? [...prev, s] : prev.filter((x) => x !== s)))
                  }
                />
                {s}
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="k-rate">限流（次/分钟）</label>
          <input id="k-rate" type="number" min={1} max={10000} value={rateLimit} onChange={(e) => setRateLimit(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="k-exp">过期时间（可选）</label>
          <input id="k-exp" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="k-domains">域名白名单（可选，逗号分隔）</label>
          <input
            id="k-domains"
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
            placeholder="app.example.com, foo.cn"
          />
        </div>
        <button className="btn primary" disabled={busy || scopes.length === 0}>
          {busy ? "创建中…" : "创建 Key"}
        </button>
      </form>
      <p className={styles.hintLine}>
        域名白名单为空时不限制来源；配置后该 Key 仅允许来自白名单域名的浏览器调用（依据 Origin/Referer，直接
        cURL 等无来源请求将被拒绝，服务端集成请另建不带白名单的 Key）。
      </p>

      {created && (
        <div className={styles.modalMask} onClick={() => setCreated(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalBadge}>
              <KeyRound size={20} strokeWidth={2.2} />
            </div>
            <strong>请立即保存「{created.name}」的 Key</strong>
            <p className={styles.modalHint}>明文仅展示这一次，关闭后无法再次查看（服务端只存哈希）。</p>
            <code className={styles.keyText}>{created.key}</code>
            <div className={styles.modalActions}>
              <button className="btn primary" onClick={copyKey}>
                复制到剪贴板
              </button>
              <button className="btn" onClick={() => setCreated(null)}>
                我已保存
              </button>
            </div>
          </div>
        </div>
      )}

      <table className={styles.table}>
        <thead>
          <tr>
            <th>名称</th>
            <th>Key 前缀</th>
            <th>权限</th>
            <th>限流</th>
            <th>域名白名单</th>
            <th>最近使用</th>
            <th>过期时间</th>
            <th>状态</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((k, i) => (
            <tr key={k.id} className={k.revokedAt ? styles.revoked : ""} style={{ animationDelay: `${i * 0.04}s` }}>
              <td>{k.name}</td>
              <td>
                <code>{k.keyPrefix}…</code>
              </td>
              <td>{k.scopes.join(", ")}</td>
              <td>{k.rateLimit}/min</td>
              <td>{k.allowedDomains.length ? k.allowedDomains.join(", ") : "不限"}</td>
              <td>{formatDateTime(k.lastUsedAt)}</td>
              <td>{formatDateTime(k.expiresAt)}</td>
              <td>{k.revokedAt ? <span className={styles.badgeRevoked}>已吊销</span> : <span className={styles.badgeActive}>有效</span>}</td>
              <td>{!k.revokedAt && <button className="btn danger" onClick={() => revoke(k.id, k.name)}>吊销</button>}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={9} className={styles.empty}>
                尚无 API Key，使用上方表单创建第一个。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
