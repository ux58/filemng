/** 纯展示工具（前后端通用） */

export function formatDuration(sec?: number | null): string {
  if (!sec || sec <= 0) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "-";
  return iso.replace("T", " ").slice(0, 16);
}
