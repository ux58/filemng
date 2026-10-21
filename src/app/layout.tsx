import type { Metadata } from "next";
import { APP_NAME } from "@/shared/constants";
import { ToastHost } from "@/components/toast-host";
import { PlayerBar } from "@/components/player-bar";
import "./globals.scss";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "音乐文件管理器：歌曲 CRUD、歌词封面、开放 API",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* 首屏无闪烁：渲染前恢复主题（与 theme store 同键） */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("fmm-theme");if(t==="light")document.documentElement.dataset.theme="light"}catch(e){}`,
          }}
        />
      </head>
      <body>
        {children}
        <ToastHost />
        <PlayerBar />
      </body>
    </html>
  );
}
