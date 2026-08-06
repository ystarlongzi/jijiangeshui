# 极简个税应用

基于 Next.js、Payload CMS 和 PostgreSQL 的新应用骨架。

当前前台产品已经以 `src/app/(frontend)` 下的 Next.js 页面为准，包含工资薪金、税后反推、年终奖、分类所得、专项附加扣除、城市规则和税率表等入口。产品完成基线、数据验收结果和下一轮待办见 [docs/iteration-backlog.md](docs/iteration-backlog.md)。

## 本地启动

1. 在仓库根目录执行 `docker compose up -d postgres`。
2. 复制 `.env.example` 为 `.env`，填写 `DATABASE_URI` 和 `PAYLOAD_SECRET`。
3. 执行 `npm install`。
4. 执行 `npm run dev`。
5. 打开 `http://localhost:4000/www-app-admin` 创建第一个管理员。

生产部署、Nginx 和 HTTPS 证书流程见 [docs/deploy.zh-CN.md](../docs/deploy.zh-CN.md)。

## 导入社保规则

采集脚本下载的 JSON 默认导入为待审核草稿：

```bash
npm run rules:import -- ./data/hrwork-social-insurance-2026-07-28.json --dry-run
npm run rules:import -- ./data/hrwork-social-insurance-2026-07-28.json
```

正式写入前建议先执行 `--dry-run`。导入不会自动把政策标记为有效。

## 前台城市数据读取

前台城市数据按“城市目录”和“单城市规则”拆分，避免工资计算器初次加载全部城市的社保政策：

- `GET /api/cities?keyword=北京`：按城市名、简称、省份或拼音联想，最多返回前 20 条城市基础信息。
- `GET /api/cities?all=true`：返回全部已启用城市的基础信息，供城市列表页使用。
- `GET /api/cities/{slug}/rules`：返回选中城市的社保、公积金基数和缴费项目规则；公开响应不包含规则明细中的 `sources` 字段，顶层 `source` 仅标识数据来自 Payload 还是兜底规则。

`/calculator` 和 `/reverse-tax` 首屏只加载城市联想所需的基础信息，用户选中城市后再请求单城市规则。`/city` 和 `/city/{slug}` 仍由 Next.js 服务端直接读取并渲染，城市列表、详情内容和 SEO 元数据不会依赖浏览器端请求。

城市目录和单城市规则均通过 Payload CMS 读取，并使用 `CITY_RULE_CACHE_SECONDS` 控制服务端缓存时间，默认 300 秒；未配置数据库或读取失败时，会回退到前台内置规则。

## 当前 Collections

- `admins`：后台用户和角色
- `cities`：城市及城市 SEO 基础信息
- `social-insurance-policies`：社保公积金政策版本、基数和缴费项目规则
- `articles`：个税知识、城市政策和案例文章
- `faqs`：常见问题
- `import-jobs`：规则导入任务记录

`../prototype/` 仍然保留为历史原型参考；当前用户可访问功能以 `src/app/(frontend)` 为准，不再以 prototype 的迁移状态作为产品完成度判断依据。
