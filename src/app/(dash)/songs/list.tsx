"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiJson } from "@/shared/api-client";
import { formatDuration } from "@/shared/format";
import { Play, Music } from "lucide-react";
import { usePlayerStore } from "@/stores/player";
import { confirmDialog } from "@/components/confirm";
import { toast } from "@/stores/toast";
import type { SongDto } from "@/features/songs/service";
import styles from "./page.module.scss";

interface ListResult {
  items: SongDto[];
  total: number;
  page: number;
  pageSize: number;
}

export function SongList() {
  const router = useRouter();
  const sp = useSearchParams();
  const page = Number(sp.get("page") ?? 1);
  const q = sp.get("q") ?? "";
  const genre = sp.get("genre") ?? "";
  const year = sp.get("year") ?? "";

  const [data, setData] = useState<ListResult | null>(null);
  const [search, setSearch] = useState(q);
  const play = usePlayerStore((s) => s.play);
  const items = data?.items ?? [];

  // URL 为唯一过滤状态源：改参数即重新拉取
  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (q) params.set("q", q);
    if (genre) params.set("genre", genre);
    if (year) params.set("year", year);
    apiJson<ListResult>(`/api/v1/songs?${params}`).then(setData).catch((e) => toast.err(e.message));
  }, [page, q, genre, year]);

  useEffect(load, [load]);

  function applyFilter(next: Partial<{ q: string; genre: string; year: string; page: number }>) {
    const params = new URLSearchParams();
    const merged = { q, genre, year, page: String(page), ...Object.fromEntries(Object.entries(next).map(([k, val]) => [k, String(val)])) };
    for (const [k, val] of Object.entries(merged)) if (val && !(k === "page" && val === "1")) params.set(k, val);
    router.push(`/songs?${params}`);
  }

  async function remove(id: string, title: string) {
    if (!(await confirmDialog({ title: `删除「${title}」？`, message: "音频与封面文件将一并删除，且不可恢复。", danger: true }))) return;
    try {
      await apiJson(`/api/v1/songs/${id}`, { method: "DELETE" });
      toast.ok("已删除");
      load();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : "删除失败");
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <div className={styles.head}>
        <h1 className="page-title">歌曲库{data ? `（${data.total}）` : ""}</h1>
        <Link className="btn primary" href="/songs/new">
          + 上传歌曲
        </Link>
      </div>

      <form
        className={styles.filters}
        onSubmit={(e) => {
          e.preventDefault();
          applyFilter({ q: search, page: 1 });
        }}
      >
        <input placeholder="搜索标题 / 艺术家 / 专辑…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <input placeholder="流派" defaultValue={genre} onBlur={(e) => applyFilter({ genre: e.target.value, page: 1 })} />
        <input placeholder="年份" type="number" defaultValue={year} onBlur={(e) => applyFilter({ year: e.target.value, page: 1 })} />
        <button className="btn">搜索</button>
      </form>

      <div className={styles.grid}>
        {items.map((song, i) => (
          <article
            key={song.id}
            className={`${styles.card} card-panel`}
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <Link href={`/songs/${song.id}`} className={styles.coverWrap} aria-label={song.title}>
              {song.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.cover} src={song.cover.url} alt="" loading="lazy" />
              ) : (
                <div className={`${styles.cover} ${styles.ph}`}>
                  <Music size={40} strokeWidth={1.6} />
                </div>
              )}
              {song.audio && (
                <button
                  className={styles.playBtn}
                  onClick={(e) => {
                    e.preventDefault();
                    play(song, items); // 带入完整列表作为播放队列
                  }}
                  title="播放"
                >
                  <Play size={16} strokeWidth={2.4} />
                </button>
              )}
              {song.durationSec != null && <span className={styles.dur}>{formatDuration(song.durationSec)}</span>}
            </Link>
            <div className={styles.body}>
              <Link href={`/songs/${song.id}`} className={styles.title}>
                {song.title}
              </Link>
              <span className={styles.artist}>{song.artist ?? "未知艺术家"}</span>
              <div className={styles.tags}>
                {song.album && <span className={styles.tag}>{song.album}</span>}
                {song.genre && <span className={`${styles.tag} ${styles.tagAccent}`}>{song.genre}</span>}
                {song.year && <span className={styles.tag}>{song.year}</span>}
              </div>
              <div className={styles.ops}>
                <Link className="btn" href={`/songs/${song.id}/edit`}>
                  编辑
                </Link>
                <button className="btn danger" onClick={() => remove(song.id, song.title)}>
                  删除
                </button>
              </div>
            </div>
          </article>
        ))}
        {data && data.items.length === 0 && (
          <div className={`${styles.empty} card-panel`}>
            <span className={styles.emptyIcon}>
              <Music size={26} strokeWidth={1.8} />
            </span>
            暂无歌曲，点击右上角「上传歌曲」开始。
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className={styles.pager}>
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <button key={p} className={p === page ? styles.cur : ""} onClick={() => applyFilter({ page: p })}>
              {p}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
