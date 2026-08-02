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

5. `publish-social-insurance-policies.ts`
   - 把确认可用的政策草稿发布为前台有效规则。
   - 默认 dry-run；只有追加 `--write` 才会写数据库。

6. `cms-rules-summary.ts`
   - 只读 Payload CMS，汇总城市、政策状态、有效规则覆盖率、来源和警告数量。
   - 适合导入或发布后快速确认数据库里到底有什么。

## 常用命令

如果只是日常维护，优先按下面几种场景选择命令：

| 场景 | 推荐命令 | 结果怎么看 |
| --- | --- | --- |
| 想知道 CMS 里现在有多少城市规则 | `npm run rules:cms-summary -- --policy-year 2026` | 看 `active` 覆盖、未覆盖城市数量、来源 URL 覆盖率、核对日期覆盖率。这个命令只读数据库，不会改数据。 |
| 想检查当前已发布规则能不能给前台用 | `npm run rules:audit -- --cms --policy-year 2026 --summary` | 看前台可用城市、OK/warning/error 城市数。`error` 需要先修，`warning` 通常是来源或核对信息不完整。 |
| 想找出需要复核的城市 | `npm run rules:audit -- --cms --policy-year 2026 --stale --summary` | 只展示缺少核对日期或核对日期超过阈值的城市，适合做下一轮数据维护清单。 |
| 想采集 Hrwork 数据 | `npm run rules:crawl-hrwork -- --all --policy-year 2026 --effective-from 2026-01-01` | 默认由本地脚本采集。只有接口被限制时，再让人去浏览器控制台运行备用脚本。 |
| 想把采集 JSON 跑完整流程 | `npm run rules:pipeline -- ./data/xxx.json` | 只做校验、审计和导入 dry-run，不写数据库。 |
| 想写入 CMS 草稿 | `npm run rules:pipeline -- ./data/xxx.json --write` | 写入 `pendingReview` 草稿，不会直接影响前台。 |
| 想发布给前台使用 | `npm run rules:pipeline -- ./data/xxx.json --write --publish --clear-warnings --policy-year 2026` | 会发布为 `active`，前台城市规则优先读取 CMS。确认数据可信后再执行。 |
| 想更新前台兜底规则 | `npm run rules:export-fallback -- ./data/fallback-rules.json` | 只在 CMS 数据已经稳定、需要同步兜底数据时使用。 |

`rules:pipeline` 已经把 `validate -> audit -> import -> publish -> summary` 串起来了，所以手动导入 JSON 时不需要分 4 次执行。默认不加 `--write` 时只预演；加 `--write` 才写入 Payload CMS；再加 `--publish` 才发布给前台。

需要连接 Payload CMS 的命令依赖 `.env` 或 `.env.local` 里的 `DATABASE_URI` 和 `PAYLOAD_SECRET`。只做 JSON 校验或 dry-run 时，通常不会被数据库环境卡住。

```bash
npm run rules:validate -- ./data/city-rules-seed.json
npm run rules:audit -- ./data/city-rules-seed.json
npm run rules:audit -- --cms --policy-year 2026
npm run rules:audit -- --cms --policy-year 2026 --summary
npm run rules:audit -- --cms --policy-year 2026 --stale --summary
npm run rules:import -- ./data/city-rules-seed.json --dry-run
npm run rules:import-seed:dry-run
npm run rules:publish -- --policy-year 2026
npm run rules:publish -- --policy-year 2026 --write --clear-warnings
npm run rules:cms-summary -- --policy-year 2026
npm run rules:sources
npm run rules:sources -- --gaps

npm run rules:export-fallback -- ./data/fallback-rules.json
npm run rules:audit
```

真正写入数据库时去掉 `--dry-run`，也可以直接执行 `npm run rules:import-seed`。导入脚本只有在非 dry-run 时才会加载 Payload，避免本地预览被数据库环境变量卡住。
`rules:audit` 默认只把 error 视为失败；加 `--strict` 后，warning 也会让命令失败，适合接入 CI。追加 `--cms` 可以直接审计 Payload CMS 当前已发布规则；追加 `--summary` 可以只看汇总和少量问题样例；追加 `--stale` 会过滤出缺少核对日期或核对日期偏旧的城市。
`rules:cms-summary` 只读数据库，不校验每条规则数字是否合理；它用于回答“当前 CMS 覆盖了多少城市、多少 active、多少 pendingReview、还有多少启用城市没有 active 规则”。需要逐条质量审计时继续用 `rules:audit -- --cms`。

`data/city-rules-seed.json` 是当前首批可导入规则种子，来自前台内置兜底规则。它用于先跑通 Payload 导入和后台审核链路；后续逐城补齐官方来源 URL、核对日期和更精细的政策版本后，再替换为官方核验数据。

## Hrwork 批量采集接入

默认先用本地脚本采集，不需要手动打开浏览器控制台。只有 Hrwork 接口限制服务端请求、脚本无法访问时，再退回 `../scripts/hrwork-social-insurance-console-crawler.js` 的浏览器控制台方案。

采集指定城市：

```bash
npm run rules:crawl-hrwork -- --city 北京 --policy-year 2026 --effective-from 2026-01-01 --output ./data/hrwork-beijing-2026.json
```

先采样 5 个城市：

```bash
npm run rules:crawl-hrwork -- --limit 5 --policy-year 2026 --effective-from 2026-01-01 --output ./data/hrwork-sample-2026.json
```

全量采集：

```bash
npm run rules:crawl-hrwork -- --all --policy-year 2026 --effective-from 2026-01-01 --concurrency 3 --delay-ms 500
```

拿到 JSON 后，一条命令跑完整导入流水线：

```bash
npm run rules:pipeline -- ./data/hrwork-social-insurance-2026-08-01.json
```

默认只执行 `validate -> audit -> import --dry-run`，确认无误后追加 `--write` 写入 Payload CMS 草稿：

```bash
npm run rules:pipeline -- ./data/hrwork-social-insurance-2026-08-01.json --write
```

写入或发布后会自动输出一次 Payload CMS 规则概览，方便确认城市覆盖、政策状态、来源和 warning 数量。如果只想执行导入动作，可以追加 `--no-summary`。

如果这批数据已经确认可用于前台，可以继续追加 `--publish`。Hrwork 数据会带第三方来源 warning；确认无误后用 `--clear-warnings` 清掉这类审核提示并发布：

```bash
npm run rules:pipeline -- ./data/hrwork-social-insurance-2026-08-01.json --write --publish --clear-warnings --policy-year 2026
```

如果本地脚本被 Hrwork 限制，再使用浏览器控制台备用方案：

1. 在浏览器打开 `https://web.hrwork.com`。
2. 打开开发者工具 Console，把 `scripts/hrwork-social-insurance-console-crawler.js` 完整粘贴进去。
3. 执行小范围采集或全量采集：

```js
const result = await crawlHrworkSocialInsuranceRules({
  cityFilter: (area) => ['北京', '上海', '广州', '深圳', '杭州'].some((name) => area.areaName.includes(name)),
  policyYear: '2026',
  effectiveFrom: '2026-01-01',
  concurrency: 2,
  delayMs: 500,
})
```

```js
const result = await crawlAllHrworkSocialInsuranceRules({
  policyYear: '2026',
  effectiveFrom: '2026-01-01',
  concurrency: 3,
  delayMs: 500,
})
```

导入到 Payload 后会创建或更新 `社保公积金政策` 草稿，业务状态默认为 `pendingReview`。因为 Hrwork 是第三方聚合来源，导入脚本会自动给这些政策写入审核警告；确认数据可用后，执行 `npm run rules:publish -- --policy-year 2026 --write --clear-warnings` 清理 warning 并发布为 `active`。

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
