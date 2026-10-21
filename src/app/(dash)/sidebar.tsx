"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { APP_NAME } from "@/shared/constants";
import { useThemeStore } from "@/stores/theme";
import styles from "./dash.module.scss";

const NAV = [
  { href: "/songs", label: "歌曲库", icon: "♪" },
  { href: "/keys", label: "API Keys", icon: "⚿" },
  { href: "/settings", label: "设置", icon: "⚙" },
  { href: "/docs", label: "API 文档", icon: "◇" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, init, toggle } = useThemeStore();

  useEffect(init, [init]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.logo}>♫</span>
        {APP_NAME}
      </div>
      <nav className={styles.nav}>
        {NAV.map((item, i) => (
          <Link
            key={item.href}
            href={item.href}
            style={{ animationDelay: `${0.05 + i * 0.06}s` }}
            className={`${styles.item} ${pathname.startsWith(item.href) ? styles.active : ""}`}
          >
            <span className={styles.icon}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className={styles.footer}>
        <button className="btn" onClick={toggle} title={theme === "dark" ? "切换到亮色模式" : "切换到暗色模式"} aria-label="切换主题">
          <span className={styles.themeIcon} key={theme}>
            {theme === "dark" ? "☀" : "☾"}
          </span>
          <span className={styles.btnText}>{theme === "dark" ? "亮色模式" : "暗色模式"}</span>
        </button>
        <button className="btn" onClick={logout} aria-label="退出登录">
          <span className={styles.themeIcon}>⏻</span>
          <span className={styles.btnText}>退出登录</span>
        </button>
      </div>
    </aside>
  );
}
