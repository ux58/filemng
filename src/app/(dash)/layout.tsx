import { Sidebar } from "./sidebar";
import styles from "./dash.module.scss";

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <main className={styles.main}>{children}</main>
    </>
  );
}
