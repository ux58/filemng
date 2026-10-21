"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiJson } from "@/shared/api-client";
import { formatDuration } from "@/shared/format";
import { usePlayerStore } from "@/stores/player";
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
    if (!confirm(`确定删除「${title}」？音频与封面文件将一并删除。`)) return;
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

      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.wCover}>封面</th>
            <th>标题</th>
            <th>艺术家</th>
            <th>专辑</th>
            <th>流派</th>
            <th>年份</th>
            <th className={styles.wDur}>时长</th>
            <th className={styles.wOps}>操作</th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((song) => (
            <tr key={song.id}>
              <td>
                {song.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={styles.cover} src={song.cover.url} alt="" />
                ) : (
                  <div className={`${styles.cover} ${styles.ph}`} />
                )}
              </td>
              <td>
                <Link href={`/songs/${song.id}`}>{song.title}</Link>
              </td>
              <td>{song.artist ?? "-"}</td>
              <td>{song.album ?? "-"}</td>
              <td>{song.genre ?? "-"}</td>
              <td>{song.year ?? "-"}</td>
              <td>{formatDuration(song.durationSec)}</td>
              <td className={styles.ops}>
                {song.audio && (
                  <button className="btn" onClick={() => play(song)} title="播放">
                    ▶
                  </button>
                )}
                <Link className="btn" href={`/songs/${song.id}/edit`}>
                  编辑
                </Link>
                <button className="btn danger" onClick={() => remove(song.id, song.title)}>
                  删除
                </button>
              </td>
            </tr>
          ))}
          {data && data.items.length === 0 && (
            <tr>
              <td colSpan={8} className={styles.empty}>
                暂无歌曲，点击右上角「上传歌曲」开始。
              </td>
            </tr>
          )}
        </tbody>
      </table>

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
