# 部署指南（全免费额度，零绑卡）

## 实际采用的线上方案：Render + Neon + Supabase Storage

> 本项目线上部署：**Render**（Node 常驻，免费实例）+ **Neon Postgres**（数据）+
> **Supabase Storage**（S3 兼容对象存储，音频/封面）。三者均可 GitHub 登录，全程无需绑卡。
> （Vercel 免费版对新账号有风控拦截；Cloudflare R2 激活需绑卡，故弃用。）

| 组件 | 服务 | 角色 |
|---|---|---|
| 应用 | Render Web Service（Free，Singapore） | Node 常驻 `npm start` |
| 数据库 | Neon Postgres（Free） | users/sessions/songs/api_keys/settings |
| 文件 | Supabase Storage S3 网关（Free） | 音频/封面对象，浏览器直传 + 服务端流式读取 |

Supabase S3 网关实测兼容性：预签名 PUT ✅（CORS 默认 `*`）、HeadObject ✅、Range 206 ✅、Delete ✅。

### Render 配置要点

- Region: Singapore；Instance: Free（0.1 CPU / 512MB；闲置 15 分钟休眠，唤醒约 50 秒）
- Build: `npm install; npm run build`；Start: `npm run start`
- 环境变量：`DATABASE_DRIVER=postgres`、`DATABASE_URL=<Neon 连接串>`、`JWT_SECRET=<≥32 字节随机串>`
- 存储配置在应用「设置」页写入数据库 settings 表（也可直接在 Neon 中插入该行）

## 备选：Vercel + Neon + Supabase（Serverless）

本应用为 Next.js 全栈单体。Serverless 平台（Vercel）的函数请求体上限为 **4.5MB**，
因此音频/封面上传采用**预签名直传**：服务端只签发 URL，文件由浏览器直传对象存储，
服务端在落库前用 `HeadObject` 复核对象真实大小与类型（不信任客户端声明）。

```
浏览器 ──PUT 音频/封面──▶ Supabase Storage S3 网关（直传，不经过 Serverless）
   │
   ├─ POST /api/v1/songs/upload-url   （签发直传 URL，songs:write）
   └─ POST /api/v1/songs（JSON）       （提交元数据 + 直传键，服务端 head() 复核）
Vercel ◀──数据库──▶ Neon Postgres（歌曲/用户/Key 元数据，单行极小）
```

本地开发与自托管（Node 常驻 + 本地磁盘/S3）不受 4.5MB 限制，multipart 上传路径保持原样；
`/api/v1/storage-mode` 告诉前端当前走哪条通道，两套逻辑自动分流。

## 验证清单

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

- Render 免费实例闲置 15 分钟休眠，唤醒需约 50 秒（个人轻度使用可接受；升级 $7/月即常驻）
- 限流/会话缓存在进程内存，单实例部署无碍；多实例需外置（Redis）
- Neon 免费实例空闲会被挂起，首次请求有 ~1s 冷启动
- Supabase 免费项目 7 天无活动会暂停（控制台一键恢复）；正常使用（有播放/上传请求）不会触发
