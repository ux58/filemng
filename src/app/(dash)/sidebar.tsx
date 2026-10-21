"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { APP_NAME } from "@/shared/constants";
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
      <button className="btn" onClick={logout}>
        退出登录
      </button>
    </aside>
  );
}
