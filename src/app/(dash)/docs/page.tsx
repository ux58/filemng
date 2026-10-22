import styles from "./page.module.scss";

const ENDPOINTS = [
  { m: "GET", p: "/api/v1/songs?page=1&pageSize=20&q=关键词&genre=Pop&year=2024", s: "songs:read", d: "分页查询歌曲（关键词模糊匹配标题/艺术家/专辑）" },
  { m: "POST", p: "/api/v1/songs", s: "songs:write", d: "创建歌曲：multipart/form-data，payload=JSON 元数据，audio/cover=可选文件" },
  { m: "GET", p: "/api/v1/songs/{id}", s: "songs:read", d: "获取单曲详情（含歌词、文件 URL）" },
  { m: "PATCH", p: "/api/v1/songs/{id}", s: "songs:write", d: "更新：JSON 仅元数据；multipart 可同时替换 audio/cover" },
  { m: "DELETE", p: "/api/v1/songs/{id}", s: "songs:write", d: "删除歌曲及其音频/封面文件" },
  { m: "GET", p: "/api/health", s: "无需鉴权", d: "健康检查" },
];

export default function DocsPage() {
  return (
    <div className={styles.docs}>
      <h1 className="page-title">开放 API 文档</h1>
      <p>
        所有 <code>/api/v1/*</code> 端点同时接受两种认证方式：外部调用使用{" "}
        <code>X-API-Key: fmm_xxx</code> 请求头（在「API Keys」页创建）；浏览器管理端使用会话 Cookie（自动携带）。
      </p>
      <ul>
        <li>
          Key 权限按 scope 收敛：<code>songs:read</code> 只读，<code>songs:write</code> 写入。
        </li>
        <li>
          域名白名单：创建 Key 时可绑定允许的来源域名（如 <code>app.example.com</code>），配置后仅白名单页面的前端可以携带该 Key 调用；留空则不限制（适合服务端直连）。
        </li>
        <li>每个 Key 独立限流（默认 60 次/分钟），超限返回 429 与 <code>Retry-After</code> 头。</li>
        <li>错误统一为 <code>{"{ error: { code, message } }"}</code>。</li>
      </ul>

      <h2>端点一览</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>方法</th>
            <th>路径</th>
            <th>所需权限</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          {ENDPOINTS.map((e) => (
            <tr key={e.m + e.p}>
              <td>
                <span className={`${styles.method} ${styles[e.m.toLowerCase()]}`}>{e.m}</span>
              </td>
              <td>
                <code>{e.p}</code>
              </td>
              <td>
                <code>{e.s}</code>
              </td>
              <td>{e.d}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>cURL 示例</h2>
      <pre className={styles.code}>{`# 1. 创建 Key（在「API Keys」页操作），假设得到 fmm_xxxxxxxxxxxx

# 2. 查询歌曲列表
curl -H "X-API-Key: fmm_xxxxxxxxxxxx" \\
  "http://localhost:3000/api/v1/songs?page=1&pageSize=10&q=love"

# 3. 上传歌曲（payload 为 JSON 字符串，音频/封面可选）
curl -X POST -H "X-API-Key: fmm_xxxxxxxxxxxx" \\
  -F 'payload={"title":"Yesterday","artist":"The Beatles","lyrics":"Yesterday..."}' \\
  -F "audio=@/path/to/song.mp3" \\
  -F "cover=@/path/to/cover.jpg" \\
  "http://localhost:3000/api/v1/songs"

# 4. 更新歌词
curl -X PATCH -H "X-API-Key: fmm_xxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"lyrics":"Yesterday, all my troubles seemed so far away..."}' \\
  "http://localhost:3000/api/v1/songs/{id}"

# 5. 删除
curl -X DELETE -H "X-API-Key: fmm_xxxxxxxxxxxx" \\
  "http://localhost:3000/api/v1/songs/{id}"`}</pre>
    </div>
  );
}
