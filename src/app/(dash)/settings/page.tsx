"use client";

import { useEffect, useState } from "react";
import { apiJson, apiJsonBody } from "@/shared/api-client";
import { formatBytes } from "@/shared/format";
import { toast } from "@/stores/toast";
import styles from "./page.module.scss";

interface Settings {
  storage: {
    driver: "local" | "s3";
    localRoot: string;
    s3: { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string };
  };
  upload: { audioMaxBytes: number; imageMaxBytes: number };
}

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiJson<Settings>("/api/settings").then(setS).catch((e) => toast.err(e.message));
  }, []);

  if (!s) return null;
  const patch = (fn: (draft: Settings) => void) =>
    setS((prev) => {
      const draft = structuredClone(prev!);
      fn(draft);
      return draft;
    });

  async function save() {
    if (!s) return;
    setBusy(true);
    try {
      const saved = await apiJsonBody<Settings>("PUT", "/api/settings", s);
      // 密钥不回显：保留输入框原值避免误解为已保存的值
      saved.storage.s3.secretAccessKey = s.storage.s3.secretAccessKey;
      setS(saved);
      toast.ok("设置已保存");
    } catch (e) {
      toast.err(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function testStorage() {
    setBusy(true);
    try {
      await apiJson("/api/settings/test-storage", { method: "POST" });
      toast.ok("存储连接正常");
    } catch (e) {
      toast.err(e instanceof Error ? e.message : "连接失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="page-title">设置</h1>

      <section className={styles.card}>
        <h2>文件存储</h2>
        <div className="field">
          <label htmlFor="st-driver">存储后端</label>
          <select id="st-driver" value={s.storage.driver} onChange={(e) => patch((d) => (d.storage.driver = e.target.value as Settings["storage"]["driver"]))}>
            <option value="local">本地磁盘（默认 ./uploads）</option>
            <option value="s3">S3 兼容对象存储（AWS / MinIO / R2 / OSS / COS）</option>
          </select>
        </div>

        {s.storage.driver === "local" ? (
          <div className="field">
            <label htmlFor="st-root">本地根目录（相对项目根或绝对路径）</label>
            <input id="st-root" value={s.storage.localRoot} onChange={(e) => patch((d) => (d.storage.localRoot = e.target.value))} placeholder="./uploads" />
          </div>
        ) : (
          <div className={styles.grid}>
            <div className="field">
              <label htmlFor="st-endpoint">Endpoint（留空使用 AWS 官方）</label>
              <input id="st-endpoint" value={s.storage.s3.endpoint} onChange={(e) => patch((d) => (d.storage.s3.endpoint = e.target.value))} placeholder="https://xxx.r2.cloudflarestorage.com" />
            </div>
            <div className="field">
              <label htmlFor="st-region">Region</label>
              <input id="st-region" value={s.storage.s3.region} onChange={(e) => patch((d) => (d.storage.s3.region = e.target.value))} placeholder="us-east-1 / auto" />
            </div>
            <div className="field">
              <label htmlFor="st-bucket">Bucket</label>
              <input id="st-bucket" value={s.storage.s3.bucket} onChange={(e) => patch((d) => (d.storage.s3.bucket = e.target.value))} />
            </div>
            <div className="field">
              <label htmlFor="st-ak">Access Key ID</label>
              <input id="st-ak" value={s.storage.s3.accessKeyId} onChange={(e) => patch((d) => (d.storage.s3.accessKeyId = e.target.value))} />
            </div>
            <div className="field">
              <label htmlFor="st-sk">Secret Access Key（留空保留原值）</label>
              <input id="st-sk" type="password" value={s.storage.s3.secretAccessKey} onChange={(e) => patch((d) => (d.storage.s3.secretAccessKey = e.target.value))} placeholder="••••••" />
            </div>
          </div>
        )}
        <button className="btn" onClick={testStorage} disabled={busy}>
          测试连接
        </button>
        <p className={styles.hint}>切换后端不影响已有文件：每个文件记录创建时的存储位置，历史文件仍按原后端读取。</p>
      </section>

      <section className={styles.card}>
        <h2>上传限额</h2>
        <div className={styles.grid}>
          <div className="field">
            <label htmlFor="st-audio">音频上限（MB）</label>
            <input
              id="st-audio"
              type="number"
              min={1}
              value={Math.round(s.upload.audioMaxBytes / 1024 / 1024)}
              onChange={(e) => {
                const mb = Number(e.target.value);
                if (!Number.isFinite(mb) || mb < 1) return; // 拒绝非法/非正值
                patch((d) => (d.upload.audioMaxBytes = mb * 1024 * 1024));
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="st-image">图片上限（MB）</label>
            <input
              id="st-image"
              type="number"
              min={1}
              value={Math.round(s.upload.imageMaxBytes / 1024 / 1024)}
              onChange={(e) => {
                const mb = Number(e.target.value);
                if (!Number.isFinite(mb) || mb < 1) return;
                patch((d) => (d.upload.imageMaxBytes = mb * 1024 * 1024));
              }}
            />
          </div>
        </div>
        <p className={styles.hint}>
          当前：音频 ≤ {formatBytes(s.upload.audioMaxBytes)}，图片 ≤ {formatBytes(s.upload.imageMaxBytes)}；实际还受服务器
          body 限制约束。
        </p>
      </section>

      <button className="btn primary" onClick={save} disabled={busy}>
        {busy ? "保存中…" : "保存设置"}
      </button>

      <section className={`${styles.card} ${styles.readonly}`}>
        <h2>数据库连接（只读）</h2>
        <p className={styles.hint}>
          数据库类型与连接串属引导级配置，存于 <code>.env</code>（DATABASE_DRIVER / DATABASE_URL），修改后需重启进程；
          MySQL/Postgres 首次使用请先运行 <code>npm run db:push</code>。
        </p>
      </section>
    </>
  );
}
