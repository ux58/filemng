# 音乐文件管理器（FileMng）技术开发方案

## 1. 架构形态与技术栈

Next.js **全栈单体**：App Router 同时承载 React 前端与后端 Route Handlers，单进程部署、无 CORS、代码量最小。测试链采用 Vitest（Vite 内核）。

| 维度 | 选型 | 说明 |
|---|---|---|
| 框架 | Next.js 16 + React 19 | 先 winget 升级 Node 22 LTS；失败自动回退 Node 18 + Next 15.5，功能不变 |
| 语言/样式/状态 | TypeScript 5 (strict)、SCSS Modules + CSS 变量设计令牌、Zustand 5 | |
| ORM | Drizzle ORM + drizzle-kit | 一套 TS Schema 适配三种库 |
| 数据库驱动 | SQLite: `@libsql/client`（纯 JS，Windows ARM64 免原生编译）；MySQL: `mysql2`；PostgreSQL: `postgres` | 均无原生编译依赖 |
| 鉴权 | jose(JWT) + bcryptjs + DB 会话表，HttpOnly Cookie | 自研轻量会话，无重依赖 |
| 开放 API | API Key（SHA-256 哈希落库 + scope + 限流） | 参照 GitHub/Stripe 实践 |
| 存储 | StorageAdapter 抽象：local（默认 `./uploads`）/ S3 兼容（AWS、MinIO、R2、OSS、COS） | `@aws-sdk/client-s3` |
| 元数据 | music-metadata | 上传时自动解析 ID3 时长/艺术家/专辑 |
| 校验 | Zod 前后端共享 Schema | |
| 规约/测试 | ESLint 9 flat + Prettier + Conventional Commits + Vitest + GitHub Actions CI | |

## 2. 分层架构（高内聚低耦合，单向依赖）

```
src/
  app/                    路由层（薄）：只做参数解析与调用
    (pub)/login /setup    公开页（/setup 仅首次运行可用）
    (dash)/songs|api-keys|settings|docs   受保护页（侧边栏布局）
    api/auth/*            login / logout / refresh
    api/v1/*              数据端点（会话 Cookie 或 API Key 双通道鉴权）
    files/[...key]        文件读取（Range 流式播放）
  features/               业务模块（内聚 schema + service + UI）
    auth/ songs/ api-keys/ settings/
  server/                 服务端基础设施（仅 server 侧可导入）
    db/ storage/ security/（哈希·JWT·API Key·限流·魔数嗅探）
  shared/ stores/         共享纯工具 / Zustand（toast、当前用户、播放器）
```
依赖规则：`app → features → shared`；`features/service → server`；UI 组件不得直接依赖 server；禁止特性间横向 import。

## 3. 数据模型

- **users**：id, username(unique), password_hash(bcrypt), role, timestamps
- **sessions**：id, user_id, refresh_hash, expires_at, revoked_at, ua/ip —— 支持登出吊销与刷新令牌轮换
- **api_keys**：id, name, key_prefix(展示用前 8 位), key_hash(SHA-256), scopes(`songs:read|songs:write`), rate_limit, last_used_at, expires_at, revoked_at, timestamps
- **songs**：id, title, artist, album, genre, year, duration_sec, track_no, description, lyrics(text)，audio_{key,name,mime,size}，cover_{key,name,mime,size}，timestamps
- **settings**：key(PK), value(JSON) —— 运行时配置

## 4. 鉴权设计

**管理员会话（Web UI）**
- 首次运行 `/setup` 创建管理员，无默认口令
- 登录 → 短时 Access JWT（2h）HttpOnly+Secure+SameSite=Lax Cookie + Refresh Token（哈希入库，14d，仅 refresh 端点可用，轮换）
- middleware 做轻量 JWT 检查与安全响应头；完整校验在 handler/server component 的 `requireUser()`
- 登录限流（IP+用户名）、错误信息泛化（不区分用户不存在/密码错误）

**开放 API（外部调用）**
- Key 格式 `fmm_<32 字节随机>`，**仅创建时明文展示一次**，库中只存 SHA-256 与前缀
- 请求头 `X-API-Key`，timingSafeEqual 防时序侧信道
- scope：`songs:read` / `songs:write`；管理 UI 创建/吊销/设有效期与限速
- 每 Key 内存令牌桶限流（默认 60 req/min 可配），429 + Retry-After
- 统一错误格式 `{ error: { code, message } }`

**双通道收敛**：`/api/v1/*` 同一套 Handler 接受「会话 Cookie（隐含全部 scope）」或「API Key」，管理 UI 与外部调用共用接口，避免两套 CRUD。

## 5. 开放 API（/api/v1）

- `GET /api/v1/songs`（分页/关键词/artist/genre/year 过滤）、`POST`（multipart：payload JSON + audio/cover 文件）
- `GET|PATCH|DELETE /api/v1/songs/:id`
- `GET /files/:key`（随机不可猜文件名、Range 流式、MIME 白名单、不可变缓存）
- `GET /api/health`；管理端内置 API 文档页（cURL 示例 + scope 说明）

## 6. 数据库与存储配置化（两级，业界标准）

- **引导级（.env）**：`DATABASE_DRIVER=sqlite|mysql|postgres` + `DATABASE_URL`、`JWT_SECRET`（数据库连接无法存于库自身）
- **运行时级（settings 表 + 设置页）**：存储后端 local|s3、本地根目录（默认 `./uploads`）、S3 endpoint/region/bucket/凭据、上传限额（音频 100MB/图片 10MB）、MIME 白名单；设置页提供「连接测试」
- **默认零配置可用**：SQLite（`./data/app.db`）+ 本地 `./uploads`；切换后端后旧文件仍可读（记录 key+driver）

## 7. 安全加固清单

全链路 Zod strict 校验；Drizzle 参数化防 SQLi；上传魔数嗅探（mp3/ogg/wav/flac/m4a、jpeg/png/webp/gif/avif）+ 随机化文件名 + 本地 key 白名单正则防路径穿越；密钥与密码仅存哈希、日志脱敏；安全响应头（X-Content-Type-Options / X-Frame-Options / Referrer-Policy / 基础 CSP）。

## 8. 前端设计

侧边栏布局 + CSS 变量设计令牌（暗色主题）。歌曲页：封面缩略表格、URL searchParams 驱动的搜索过滤分页、新建/编辑表单（music-metadata 自动回填元数据）、详情页（歌词查看 + 播放器）；API Keys 页（明文仅弹窗一次、scope 勾选、吊销）；设置页（存储配置 + 连接测试 + 限额）。Zustand 仅承载 toast/当前用户/播放器状态，服务端数据不做重复全局 store。

## 9. 实施步骤（每步可验证）

1. winget 升级 Node 22 → create-next-app 脚手架 + 依赖 + ESLint/Prettier/Vitest 规约配置
2. server 基础设施：db 多驱动切换 + Schema/迁移；local/S3 存储适配器；security 工具集；settings 服务
3. 鉴权特性：/setup、login/logout/refresh、middleware、requireUser
4. songs 特性：schema/service/双通道路由/上传解析/文件流式路由
5. api-keys 特性：guard + scope + 限流 + 管理 UI
6. 设置页 + 连接测试端点
7. 前端界面全套
8. Vitest 单测（哈希/JWT/刷新轮换/Key 校验限流/存储适配器含穿越防护/魔数/Schema/service CRUD 临时 SQLite）+ README + git init + CI
9. 端到端验收：build 通过 + 浏览器走通 setup→登录→上传→编辑→播放，cURL 验证 API Key 调用→吊销失效→限流 429

## 10. 非目标（范围收敛）

不做：播放列表/收藏、多角色体系、音频转码/波形、预签名直传、OpenAPI 自动生成、Docker 编排（README 留说明）；单管理员（users 预留 role 字段）。

预估 ~3k LOC，交付可 `npm run dev` 一键运行的完整项目。