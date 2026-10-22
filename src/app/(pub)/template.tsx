import styles from "./transition.module.scss";

/** (pub) 组内页面转场 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className={styles.enter}>{children}</div>;
}
