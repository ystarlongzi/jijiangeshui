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
npm run rules:export-fallback -- ./data/fallback-rules.json
npm run rules:validate -- ./data/fallback-rules.json
npm run rules:audit
npm run rules:audit -- ./data/fallback-rules.json
npm run rules:import -- ./data/fallback-rules.json --dry-run
```

真正写入数据库时去掉 `--dry-run`。导入脚本只有在非 dry-run 时才会加载 Payload，避免本地预览被数据库环境变量卡住。
`rules:audit` 默认只把 error 视为失败；加 `--strict` 后，warning 也会让命令失败，适合接入 CI。

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
