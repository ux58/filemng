"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpenText, KeyRound, LogOut, Music2, PanelLeftClose, PanelLeftOpen, Settings, Sun, Moon } from "lucide-react";
import { APP_NAME } from "@/shared/constants";
import { useThemeStore } from "@/stores/theme";
import styles from "./dash.module.scss";

const NAV = [
  { href: "/songs", label: "歌曲库", Icon: Music2 },
  { href: "/keys", label: "API Keys", Icon: KeyRound },
  { href: "/settings", label: "设置", Icon: Settings },
  { href: "/docs", label: "API 文档", Icon: BookOpenText },
];

const COLLAPSE_KEY = "fmm-sidebar-collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, init, toggle } = useThemeStore();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => init, [init]);
  // 恢复持久化的折叠状态（rAF 应用避免 effect 级联渲染；首帧短暂展开为可接受折衷）
  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_KEY) === "1") {
      requestAnimationFrame(() => setCollapsed(true));
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("sidebar-collapsed", collapsed);
  }, [collapsed]);

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
      <div className={styles.brand}>
        <span className={styles.logo}>
          <Music2 size={15} strokeWidth={2.4} />
        </span>
        <span className={styles.brandText}>{APP_NAME}</span>
      </div>
      <nav className={styles.nav}>
        {NAV.map((item, i) => (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            style={{ animationDelay: `${0.05 + i * 0.06}s` }}
            className={`${styles.item} ${pathname.startsWith(item.href) ? styles.active : ""}`}
          >
            <span className={styles.icon}>
              <item.Icon size={15} strokeWidth={2.2} />
            </span>
            <span className={styles.btnText}>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className={styles.footer}>
        <button
          className="btn"
          onClick={toggle}
          title={theme === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
          aria-label="切换主题"
        >
          <span className={styles.icon}>
            {theme === "dark" ? <Sun size={15} strokeWidth={2.2} /> : <Moon size={15} strokeWidth={2.2} />}
          </span>
          <span className={styles.btnText}>{theme === "dark" ? "亮色模式" : "暗色模式"}</span>
        </button>
        <button className="btn" onClick={logout} aria-label="退出登录" title="退出登录">
          <span className={styles.icon}>
            <LogOut size={15} strokeWidth={2.2} />
          </span>
          <span className={styles.btnText}>退出登录</span>
        </button>
        <button
          className={`btn ${styles.collapseBtn}`}
          onClick={toggleCollapse}
          aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
          title={collapsed ? "展开侧边栏" : "折叠侧边栏"}
        >
          <span className={styles.icon}>
            {collapsed ? <PanelLeftOpen size={15} strokeWidth={2.2} /> : <PanelLeftClose size={15} strokeWidth={2.2} />}
          </span>
          <span className={styles.btnText}>折叠</span>
        </button>
      </div>
    </aside>
  );
}
