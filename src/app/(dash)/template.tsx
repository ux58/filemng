import { ViewTransition } from "react";
import styles from "./transition.module.scss";

/**
 * (dash) 组内页面转场：React ViewTransition 方向性滑动。
 * 前进（列表→详情等）内容左移切入，返回（详情→列表）右移切回；
 * 无类型的导航（刷新、搜索过滤、登录跳转）不播动画。侧栏在根快照中保持不动。
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
      <div className={styles.enter}>{children}</div>
    </ViewTransition>
  );
}
