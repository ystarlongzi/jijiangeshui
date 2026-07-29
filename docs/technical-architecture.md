# 极简个税技术架构

## 1. 技术选型

```text
Next.js + Payload CMS + PostgreSQL
```

网站前端、内容后台、规则管理和服务端计算能力放在同一个 Next.js 应用中。Payload 负责结构化数据管理、后台界面、权限、草稿和版本；计算器使用独立的 TypeScript 领域模块，不把计算公式写进 CMS 字段配置。

## 2. 应用边界

```text
Next.js
├── 工资薪金计算器
├── 城市 SEO 页面
├── 个税文章、税率表、FAQ
├── Payload Admin
├── Payload REST / GraphQL / Local API
├── 个税计算引擎
└── 规则导入脚本
        ↓
    PostgreSQL
```

`prototype/` 是当前设计原型，正式前端会逐步迁移到 `app/src/app`，原型目录暂时保留用于比对视觉和交互。

正式计算器位于 `app/src/app/(frontend)/calculator/`。`app/src/lib/tax-rules.ts` 提供当前阶段的类型化规则兜底数据，`app/src/lib/tax-calculator.ts` 提供可复用的计算领域逻辑。这样即使内容数据库暂时不可用，计算器仍可展示和交互；Payload 接入后只替换城市和政策的数据读取层。

## 3. Payload Collections

| Collection | 作用 |
| --- | --- |
| `admins` | 后台登录用户和角色 |
| `cities` | 城市基础信息、第三方编码和城市 SEO 信息 |
| `social-insurance-policies` | 社保公积金政策版本、基数和缴费项目 |
| `articles` | 个税知识、城市政策、案例和税务内容 |
| `faqs` | 常见问题 |
| `import-jobs` | 规则采集和导入任务记录 |

## 4. 社保规则生命周期

```text
第三方接口 / 人工 JSON
        ↓
scripts/import-rules.ts
        ↓
城市和政策草稿
        ↓
Payload 后台人工核对
        ↓
policyStatus = active
        ↓
计算器按城市和月份读取规则
```

规则导入默认进入草稿，不会直接参与计算。政策只有在生效时间、基数范围、缴费项目和解析警告都通过检查后，才允许标记为有效。

## 5. 本地开发

仓库根目录提供 `docker-compose.yml`，用于启动独立 PostgreSQL。应用使用 `app/.env` 中的 `DATABASE_URI` 和 `PAYLOAD_SECRET`。

```bash
docker compose up -d postgres
cd app
npm install
npm run dev
```

后台地址：`http://localhost:4000/admin`

计算器地址：`http://localhost:4000/calculator`
