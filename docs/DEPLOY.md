# 部署指南（Vercel + Neon + Cloudflare R2，全免费额度）

本应用为 Next.js 全栈单体。Serverless 平台（Vercel）的函数请求体上限为 **4.5MB**，
因此音频/封面上传采用**预签名直传**：服务端只签发 URL，文件由浏览器直传对象存储，
服务端在落库前用 `HeadObject` 复核对象真实大小与类型（不信任客户端声明）。

```
浏览器 ──PUT 音频/封面──▶ Cloudflare R2（直传，不经过 Vercel）
   │
   ├─ POST /api/v1/songs/upload-url   （签发直传 URL，songs:write）
   └─ POST /api/v1/songs（JSON）       （提交元数据 + 直传键，服务端 head() 复核）
Vercel ◀──数据库──▶ Neon Postgres（歌曲/用户/Key 元数据，单行极小）
```

本地开发与自托管（Node 常驻 + 本地磁盘/S3）不受 4.5MB 限制，multipart 上传路径保持原样；
`/api/v1/storage-mode` 告诉前端当前走哪条通道，两套逻辑自动分流。

## 一、准备账号（约 15 分钟，全部免费）

1. **GitHub**：仓库推送目标（代码需在 Git 仓库中）
2. **Vercel**：<https://vercel.com> → 用 GitHub 登录（Hobby 计划，免费）
3. **Neon**：<https://neon.tech> → 用 GitHub 登录（免费 Postgres，0.5GB 起）
4. **Cloudflare**：<https://dash.cloudflare.com> → 注册免费账号（R2 对象存储，免费 10GB/月流量）

## 二、Neon：创建数据库

1. Neon 控制台 → Create project（区域选离用户近的，如 Singapore）
2. 项目页复制 **Connection string**（形如 `postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require`）
3. 本机执行一次建表（drizzle push）：

   ```bash
   DATABASE_DRIVER=postgres DATABASE_URL="<上面的连接串>" npm run db:push
   ```

## 三、Cloudflare R2：创建桶并配置 CORS

1. 控制台 → R2 → Create bucket（名称如 `filemng-audio`，区域 APAC 或自动）
2. R2 → Manage R2 API Tokens → Create API Token（权限 Object Read & Write，Specify bucket 选刚建的桶）
   → 记下 **Access Key ID / Secret Access Key / Endpoint**（形如 `https://<account_id>.r2.cloudflarestorage.com`）
3. 桶 → Settings → CORS policy，粘贴（允许浏览器直传；`https://你的域名` 换成 Vercel 分配的域名）：

   ```json
   [
     {
       "AllowedOrigins": ["https://你的域名"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

## 四、Vercel：导入并配置

1. 推送代码到 GitHub → Vercel → Add New Project → Import
2. Framework Preset 会自动识别 Next.js，Build/Start 命令用默认（`next build` / `next start`）
3. **Environment Variables** 添加：

   | 变量 | 值 |
   |---|---|
   | `DATABASE_DRIVER` | `postgres` |
   | `DATABASE_URL` | Neon 连接串 |
   | `JWT_SECRET` | `openssl rand -base64 48` 的输出 |

   （存储后端 R2 的 endpoint/bucket/密钥在应用「设置」页配置，存于数据库 settings 表，不入环境变量）
4. Deploy。完成后访问 `https://<vercel域名>/setup` 创建管理员
5. 登录 → **设置**页 → 文件存储切换为 S3 兼容：
   - Endpoint：R2 的 `https://<account_id>.r2.cloudflarestorage.com`
   - Region：`auto`
   - Bucket / AccessKeyId / SecretAccessKey：第三步记下的值
   - 点「测试连接」通过后保存
6. （可选）Settings → Domains 绑定自定义域名

## 五、验证清单

- [ ] `GET /api/health` 返回 200
- [ ] `/setup` 创建管理员 → 登录成功
- [ ] 设置页存储切换 S3 + 连接测试通过
- [ ] 上传一首 >5MB 的音频：表单提交后详情页可播放（走直传通道）
- [ ] 编辑歌曲、删除歌曲、API Key 创建/吊销正常

## 自托管对照（Node 常驻，如 VPS / Railway）

无需直传改造，按 README 环境变量启动即可（`npm run build && npm start` + pm2/systemd）；
SQLite + 本地 `uploads/` 保持默认，注意持久化 `data/` 与 `uploads/` 两个目录，
反向代理需放宽 `client_max_body_size`（≥ 上传限额）并启用 HTTPS（生产 Cookie 为 Secure）。

## 已知边界

- Vercel Hobby 函数执行时长上限 60s：/files 经函数流式回源 R2 播放，超长文件首响可能偏慢；
  如需极致播放体验可后续给 R2 桶开公开读 + CDN 域名（当前设计保持文件私有）
- 限流/会话缓存在进程内存，Serverless 下按实例独立计数（单实例轻度使用无感知）
- Neon 免费实例空闲会被挂起，首次请求有 ~1s 冷启动
