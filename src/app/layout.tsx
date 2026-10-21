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
    <html lang="zh-CN">
      <body>
        {children}
        <ToastHost />
        <PlayerBar />
      </body>
    </html>
  );
}
