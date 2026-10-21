"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { APP_NAME } from "@/shared/constants";
import styles from "./dash.module.scss";

const NAV = [
  { href: "/songs", label: "歌曲库" },
  { href: "/keys", label: "API Keys" },
  { href: "/settings", label: "设置" },
  { href: "/docs", label: "API 文档" },
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
      <div className={styles.brand}>{APP_NAME}</div>
      <nav className={styles.nav}>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className={pathname.startsWith(item.href) ? styles.active : ""}>
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
