# 社保公积金规则脚本说明

这个目录里的脚本围绕同一条链路工作：先拿到城市社保公积金规则 JSON，再校验、审计，最后写入 Payload CMS。

## 推荐阅读顺序

1. `export-fallback-rules.ts`
   - 把前台代码里的兜底城市规则导出成“采集 JSON”格式。
   - 适合本地没有真实采集数据时，用现有 `cityRules` 走完整校验和导入流程。

2. `validate-rule-import.ts`
   - 校验 JSON 结构是否满足导入最低要求。
   - 它只检查字段是否完整，不判断政策数字是否一定正确。

3. `audit-rules.ts`
   - 审计前台兜底规则或外部采集 JSON 的质量。
   - 重点检查来源、基数范围、缴费项目、公积金比例选项这些会影响计算可信度的内容。
   - 传入 JSON 文件时，会先按导入映射转换成前台 `CityRule`，再走同一套质量规则。

4. `import-rules.ts`
   - 把校验后的 JSON 写入 Payload CMS。
   - 新导入的政策默认是 `pendingReview` 草稿，避免采集数据直接影响线上计算。

## 常用命令

```bash
npm run rules:validate -- ./data/city-rules-seed.json
npm run rules:audit -- ./data/city-rules-seed.json
npm run rules:import -- ./data/city-rules-seed.json --dry-run
npm run rules:import-seed:dry-run
npm run rules:sources
npm run rules:sources -- --gaps

npm run rules:export-fallback -- ./data/fallback-rules.json
npm run rules:audit
```

真正写入数据库时去掉 `--dry-run`，也可以直接执行 `npm run rules:import-seed`。导入脚本只有在非 dry-run 时才会加载 Payload，避免本地预览被数据库环境变量卡住。
`rules:audit` 默认只把 error 视为失败；加 `--strict` 后，warning 也会让命令失败，适合接入 CI。

`data/city-rules-seed.json` 是当前首批可导入规则种子，来自前台内置兜底规则。它用于先跑通 Payload 导入和后台审核链路；后续逐城补齐官方来源 URL、核对日期和更精细的政策版本后，再替换为官方核验数据。

## Hrwork 批量采集接入

`../scripts/hrwork-social-insurance-console-crawler.js` 是浏览器控制台脚本，用来从 Hrwork 的社保公积金接口批量生成采集 JSON。

推荐流程：

1. 在浏览器打开 `https://web.hrwork.com`。
2. 打开开发者工具 Console，把 `scripts/hrwork-social-insurance-console-crawler.js` 完整粘贴进去。
3. 先小范围试跑，再全量采集：

```js
const result = await crawlHrworkSocialInsuranceRules({
  cityFilter: (area) => ['北京', '上海', '广州', '深圳', '杭州'].some((name) => area.areaName.includes(name)),
  policyYear: '2026',
  effectiveFrom: '2026-01-01',
  concurrency: 2,
  delayMs: 500,
})
```

全量采集：

```js
const result = await crawlAllHrworkSocialInsuranceRules({
  policyYear: '2026',
  effectiveFrom: '2026-01-01',
  concurrency: 3,
  delayMs: 500,
})
```

脚本默认会下载 `hrwork-social-insurance-YYYY-MM-DD.json`。把文件放到 `app/data/` 后，按顺序执行：

```bash
npm run rules:validate -- ./data/hrwork-social-insurance-2026-08-01.json
npm run rules:audit -- ./data/hrwork-social-insurance-2026-08-01.json
npm run rules:import -- ./data/hrwork-social-insurance-2026-08-01.json --dry-run
npm run rules:import -- ./data/hrwork-social-insurance-2026-08-01.json
```

导入到 Payload 后会创建或更新 `社保公积金政策` 草稿，业务状态默认为 `pendingReview`。因为 Hrwork 是第三方聚合来源，导入脚本会自动给这些政策写入审核警告；人工确认城市官方口径后，再清理 warning 并发布为 `active`。

这条链路的定位是“先批量初始化，再后台核对”，不是直接把第三方数据上线。

## 官方来源目录

```bash
npm run rules:sources
npm run rules:sources -- ./data/city-rule-sources.json --network
npm run rules:sources -- --gaps
```

`data/city-rule-sources.json` 记录每个城市当前找到的官方线索和核验状态。默认命令只检查目录结构；追加 `--network` 后，会尝试访问来源 URL，适合采集前确认页面是否还能打开。
追加 `--gaps` 后，会按养老、医疗、失业、工伤、生育和住房公积金列出每个城市缺少的基数和比例事实，适合继续采集前先确认缺口。

## 本地 Payload 导入

首次落库前先准备数据库和环境变量：

```bash
cp .env.example .env
npm run db:up
npm run rules:import-seed
```

`rules:import-seed` 会读取 `.env` 或 `.env.local` 里的 `DATABASE_URI`，把种子规则写入 Payload 草稿。导入后仍需要在后台审核并发布为 active，前台才会优先读取数据库规则。

## 数据流

```text
前台兜底 cityRules 或外部采集结果
        ↓
采集 JSON
        ↓ validate-rule-import.ts
结构和关键字段校验
        ↓ import-rules.ts
Payload CMS 草稿政策
        ↓ 人工审核/发布
前台按城市读取正式规则
```

`src/lib` 里有三类脚本会复用的规则能力：

- `city-rule-import-schema.ts`：定义采集 JSON 的宽松结构，负责先把外部数据“接住”。
- `city-rule-import-normalizer.ts`：把采集字段统一转换成 Payload/前台共用口径，例如城市 slug、来源兜底、基数和缴费项目映射。
- `city-rule-quality.ts`：定义规则质量审计逻辑，检查来源、基数范围、缴费项目和公积金比例是否可信。
