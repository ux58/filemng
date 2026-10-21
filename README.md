# FileMng 音乐库

基于 Next.js 16（App Router）+ React 19 + TypeScript + SCSS Modules + Zustand + Drizzle ORM 的音乐文件管理器：歌曲 CRUD（元数据/歌词/封面/音频）、完整鉴权登录、面向外部的 API Key 开放接口、可配置的数据库与文件存储后端。

## 快速开始

```bash
npm install
npm run dev          # http://localhost:3000
```

零配置即可运行：默认 SQLite（`./data/app.db`，首次访问自动迁移）+ 本地存储（`./uploads`）。

首次访问会引导到 `/setup` 创建管理员（无默认口令），之后在「设置」页可切换存储后端与上传限额。

## 功能

- **歌曲管理**：标题/艺术家/专辑/流派/年份/音轨号/时长/描述/歌词 + 音频与封面文件；上传时自动解析 ID3 元数据回填空字段；详情页歌词查看与底部播放条（Range 流式播放，支持拖动）
- **鉴权**：首次运行 `/setup` 创建管理员；登录签发 2h Access JWT（HttpOnly Cookie）+ 14d Refresh Token（哈希入库、轮换、可吊销）；登录接口按 IP+用户名 限流
- **开放 API**：`X-API-Key` 头调用 `/api/v1/*`；Key 仅创建时明文展示一次（服务端只存 SHA-256）；scope 收敛（`songs:read` / `songs:write`）；每 Key 独立令牌桶限流（默认 60/min，429 + Retry-After）
- **存储可配置**：本地磁盘（默认）或 S3 兼容对象存储（AWS / MinIO / Cloudflare R2 / 阿里 OSS / 腾讯 COS），设置页内切换并提供连接测试；文件记录创建时的后端，切换后历史文件仍可读
- **数据库可配置**：SQLite（默认）/ MySQL / PostgreSQL，见下文环境变量

## 环境变量（引导级，`.env`，参见 `.env.example`）

| 变量 | 说明 |
|---|---|
| `DATABASE_DRIVER` | `sqlite`（默认）/ `mysql` / `postgres` |
| `DATABASE_URL` | SQLite 文件路径（默认 `file:./data/app.db`）或标准连接串 |
| `JWT_SECRET` | 生产必填（≥32 字节随机串）；开发缺省自动生成临时密钥 |

使用 MySQL/PostgreSQL 时首次需建表：

```bash
DATABASE_DRIVER=postgres DATABASE_URL=postgres://... npm run db:push
```

## 开放 API

端点与 cURL 示例见应用内「API 文档」页（`/docs`）。概览：

```
GET    /api/v1/songs?page=&pageSize=&q=&genre=&year=   （songs:read）
POST   /api/v1/songs            （songs:write，multipart：payload JSON + audio/cover 文件）
GET    /api/v1/songs/{id}       （songs:read）
PATCH  /api/v1/songs/{id}       （songs:write，JSON 或 multipart）
DELETE /api/v1/songs/{id}       （songs:write）
GET    /api/health              （无需鉴权）
```

## 脚本

```bash
npm run dev          # 开发
npm run build        # 生产构建
npm start            # 生产运行
npm test             # Vitest 单测
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run db:push      # drizzle-kit push（MySQL/PG 建表）
npm run db:studio    # drizzle-kit studio
```

## 架构

```
src/
  app/        路由层（薄）：页面 + Route Handlers + proxy.ts（乐观鉴权/重定向）
  features/   业务模块（内聚 schema + service + UI）：songs / api-keys
  server/     服务端基础设施：db（多驱动）/ storage（local|s3）/ security / auth / settings
  shared/     前后端共享常量、格式化、校验 Schema、API client
  stores/     Zustand：toast / player
```

依赖单向：`app → features → shared`；服务端代码集中在 `server/`，UI 不直接依赖。三数据库方言 Schema 镜像一致性由单测守卫。

## 安全设计

- 上传：魔数嗅探（不信任扩展名/Content-Type）+ MIME 白名单 + 随机文件名 + 路径穿越防护 + 大小限额
- 密钥：密码 bcrypt（12 轮）；API Key SHA-256 落库 + timingSafeEqual 比较；JWT HttpOnly + SameSite
- 通用：全链路 Zod strict 校验、Drizzle 参数化、统一错误信封、安全响应头（CSP/X-Frame-Options/nosniff 等）

## 已知边界

- 限流与会话缓存为进程内存实现，多实例部署需外置（Redis）
- `/files/*` 依赖不可枚举的随机键提供访问控制，如需严格私有可增加签名 URL
- Range 请求的后缀区间（`bytes=-N`）退化为全量返回
