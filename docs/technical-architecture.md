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
| `tax-rate-rules` | 工资薪金、劳务报酬、经营所得和分类所得税率规则 |
| `special-deduction-rules` | 专项附加扣除标准、适用条件和分摊方案 |
| `articles` | 个税知识、城市政策、案例和税务内容 |
| `faqs` | 常见问题 |
| `import-jobs` | 规则采集和导入任务记录 |

### 3.1 内容系统边界

Payload 内容系统负责“页面内容和 SEO”，不负责即时计算公式。

| 内容 | 归属 Collection | 用途 |
| --- | --- | --- |
| 个税知识文章 | `articles` | 税务知识、政策解读、典型案例、SEO 长尾内容 |
| 城市介绍页内容 | `cities.seo` + `articles(category=city-policy)` | 城市页标题、描述、城市政策说明和案例入口 |
| FAQ | `faqs` | FAQ 页面、工具页 FAQ、结构化数据 FAQPage |
| SEO 标题和描述 | `articles.seo`、`cities.seo` | 页面 metadata、canonical、noIndex 控制 |

内容发布默认使用 Payload 草稿和版本能力。计算器页面如果没有 CMS 内容，也必须保留可用的本地兜底文案，不能因为内容库为空导致主流程不可用。

### 3.2 规则后台边界

规则后台负责“可计算的结构化规则”，包括城市、社保公积金政策、税率表、专项附加扣除标准和规则来源。当前已落地 `cities`、`social-insurance-policies`、`tax-rate-rules`、`special-deduction-rules` 和 `import-jobs`。

规则字段必须保留：

- 规则年度或政策年度。
- 生效日期和失效日期。
- 来源标题、来源链接和核对日期。
- 业务状态：待审核、有效、归档。
- 原始数据和解析警告，用于追溯和人工审核。

计算器只读取已发布或业务状态为有效的规则。存在解析警告、基数上下限异常、同一政策项目重复时，不允许发布为有效规则。

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

## 5. 规则采集与审核流程

采集脚本放在 `app/scripts/`。采集文件先用 `npm run rules:validate -- <json>` 做离线校验，确认 JSON 结构、城市、政策年度、生效日期、基数范围和缴费项目完整；通过后再用 `npm run rules:import -- <json>` 写入 Payload 草稿。采集结果只写入 Payload 草稿和 `import-jobs` 记录，不直接修改前端兜底规则，也不直接覆盖线上有效规则。

`app/data/rule-import-example.json` 是采集结果示例，只用于说明数据结构，不代表真实城市规则。

一次采集任务至少记录：

- 数据来源：第三方接口或人工 JSON。
- 触发方式：手动、定时或重试。
- 成功城市、失败城市和警告列表。
- 原始数据文件或原始响应摘要。
- 失败原因和人工处理备注。

审核流程：

1. 采集或人工整理 JSON。
2. 运行 `npm run rules:validate -- <json>`，先处理格式和关键字段问题。
3. 运行 `npm run rules:import -- <json>`，生成城市和政策草稿。
4. 后台查看导入任务，优先处理失败和警告城市。
5. 人工核对来源、生效日期、社保基数、公积金基数、个人和单位缴费项目。
6. 无警告且规则完整后，标记为有效。
7. 前端按城市、月份和政策生效区间读取有效规则。

本地兜底规则发布前运行 `npm run rules:audit`。若要把“来源链接缺失”等警告作为发布阻断，可使用 `npm run rules:audit -- --strict`。

## 6. 前端读取策略

短期内继续使用 `app/src/lib/tax-rules.ts` 作为兜底规则，保证本地开发和数据库不可用时仍能计算。接入 Payload 后，读取顺序为：

```text
Payload 有效规则
        ↓ 不存在或读取失败
本地兜底规则
        ↓
显示规则缺失或过期提示，允许用户手动输入基数
```

页面必须展示实际使用的规则版本和核对日期。若使用兜底规则，也要明确是内置规则，不伪装成后台实时数据。

## 7. 本地开发

仓库根目录提供 `docker-compose.yml`，用于启动独立 PostgreSQL。应用使用 `app/.env` 中的 `DATABASE_URI` 和 `PAYLOAD_SECRET`。

```bash
docker compose up -d postgres
cd app
npm install
npm run dev
```

后台地址：`http://localhost:4000/admin`

计算器地址：`http://localhost:4000/calculator`
