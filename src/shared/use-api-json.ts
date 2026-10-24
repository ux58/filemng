"use client";

import { useEffect, useState } from "react";
import { apiJson } from "./api-client";

/**
 * 路由级数据缓存（stale-while-revalidate）：
 * 命中缓存立即返回旧值先行渲染，后台静默再验证；
 * 变更操作后调用 clearApiCache() + 递增 rev 触发重取。
 */
const cache = new Map<string, unknown>();

export function clearApiCache() {
  cache.clear();
}

interface State<T> {
  key: string;
  data: T | null;
  error: boolean;
}

export function useApiJson<T>(url: string | null, rev?: unknown): { data: T | null; error: boolean } {
  const key = url ?? "";
  const init = (): State<T> => ({
    key,
    data: url ? ((cache.get(key) as T) ?? null) : null,
    error: false,
  });
  const [st, setSt] = useState<State<T>>(init);

  // url 变化（如详情页 id 切换）时同步重置为该 url 的缓存快照
  let cur = st;
  if (st.key !== key) {
    cur = init();
    setSt(cur);
  }

  useEffect(() => {
    if (!url) return;
    let alive = true;
    apiJson<T>(url)
      .then((d) => {
        if (!alive) return;
        cache.set(key, d);
        setSt({ key, data: d, error: false });
      })
      .catch(() => {
        if (alive) setSt((s) => ({ key: s.key, data: s.data, error: true }));
      });
    return () => {
      alive = false;
    };
  }, [key, url, rev]);

  return { data: cur.data, error: cur.error };
}
