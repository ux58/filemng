import styles from "./transition.module.scss";

/** (dash) 组内页面转场：每次路由切换重挂载，仅动画内容区（侧栏不受影响） */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className={styles.enter}>{children}</div>;
}
