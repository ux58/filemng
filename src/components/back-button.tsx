"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/** 返回上一页：带 nav-back 转场类型（右移切回），无历史时回退到 fallback */
export function BackButton({ fallback = "/songs" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button className="btn" onClick={() => router.push(fallback, { transitionTypes: ["nav-back"] })} aria-label="返回">
      <ChevronLeft size={14} strokeWidth={2.2} />
      返回
    </button>
  );
}
