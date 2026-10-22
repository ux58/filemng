import { Sidebar } from "./sidebar";
import styles from "./dash.module.scss";

/**
 * 布局架构：侧栏与内容区 flex 拆分。
 * shell 固定视口高度且不滚动；sidebar 为独立列（不随内容滚动/撑高）；
 * main 自持滚动（overflow-y: auto），页面转场动画发生在 main 内部。
 */
export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
