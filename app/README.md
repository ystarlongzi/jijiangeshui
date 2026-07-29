# 极简个税应用

基于 Next.js、Payload CMS 和 PostgreSQL 的新应用骨架。

## 本地启动

1. 在仓库根目录执行 `docker compose up -d postgres`。
2. 复制 `.env.example` 为 `.env`，填写 `DATABASE_URI` 和 `PAYLOAD_SECRET`。
3. 执行 `npm install`。
4. 执行 `npm run dev`。
5. 打开 `http://localhost:4000/admin` 创建第一个管理员。

## 导入社保规则

采集脚本下载的 JSON 默认导入为待审核草稿：

```bash
npm run rules:import -- ./data/hrwork-social-insurance-2026-07-28.json --dry-run
npm run rules:import -- ./data/hrwork-social-insurance-2026-07-28.json
```

正式写入前建议先执行 `--dry-run`。导入不会自动把政策标记为有效。

## 当前 Collections

- `admins`：后台用户和角色
- `cities`：城市及城市 SEO 基础信息
- `social-insurance-policies`：社保公积金政策版本、基数和缴费项目规则
- `articles`：个税知识、城市政策和案例文章
- `faqs`：常见问题
- `import-jobs`：规则导入任务记录

`prototype/` 仍然是独立的原型目录，后续会把计算器页面逐步迁移到 Next.js 前端。
