# 极简个税部署说明

本文档对应 `app/ops/deploy/deploy-ssr.mjs`、`app/ops/deploy/jijiangeshui.conf` 和 `app/ops/deploy/setup-ssl-acme.sh`，用于把极简个税部署到与伊斯兰日历相同的 Linux 服务器。

## 默认约定

- 域名：`jijiangeshui.com`
- SSH 主机：沿用伊斯兰日历部署脚本的默认服务器 `185.186.146.217`
- SSH 用户和端口：`root`、`27892`
- SSH 私钥：`~/.ssh/id_ed25519`
- 部署目录：`/www/wwwroot/jijian-geshui`
- Nginx 配置目录：`/root/websites/nginx-config/conf/`
- 应用端口：`30020`；伊斯兰日历继续使用自己的端口

如服务器参数不同，使用脚本参数覆盖，不要把生产密钥写入脚本。

## 前置条件

- DNS 已将 `jijiangeshui.com` 指向服务器。
- 服务器已安装 Node.js、npm、systemd、Nginx、PostgreSQL 和 `acme.sh`。
- 本地已安装 `ssh`、`scp` 和 `rsync`。
- 服务器防火墙已开放 80、443 和 SSH 端口。

## 生产环境变量

部署脚本默认读取 `app/.env.production`，上传前生成临时的生产环境文件，不会修改本地文件。至少需要提供真实的：

```dotenv
DATABASE_URI=postgres://用户名:密码@数据库地址:5432/jijian_geshui
PAYLOAD_SECRET=生产环境随机密钥
PAYLOAD_PREVIEW_SECRET=独立的预览密钥
NEXT_PUBLIC_SERVER_URL=https://jijiangeshui.com
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

`NEXT_PUBLIC_GA_MEASUREMENT_ID` 是 Google Analytics 4 的测量 ID，格式为 `G-XXXXXXXXXX`，不是 Google Tag Manager 容器 ID。留空时不加载 Google Analytics。

脚本会强制把上传环境中的 `NEXT_PUBLIC_SERVER_URL` 设置为 `https://jijiangeshui.com`。不要把生产密钥提交到 Git，也不要直接使用 `.env.example` 作为生产环境文件。

## 首次部署

### 1. 生成证书

同服务器上的伊斯兰日历使用 `/www/wwwroot/_acme-challenge` 作为 ACME webroot。确认 Nginx 当前配置能够通过 HTTP 提供该目录后执行：

```bash
cd /Users/liucai/Documents/极简个税/app
DOMAIN=jijiangeshui.com \
EMAIL=admin@jijiangeshui.com \
npm run deploy:ssl
```

证书默认安装到：

```text
/etc/nginx/ssl/jijiangeshui.com/fullchain.cer
/etc/nginx/ssl/jijiangeshui.com/jijiangeshui.com.key
```

证书续期由 `acme.sh` 定时任务负责，续期成功后会自动执行 `nginx -t && systemctl reload nginx`。如果服务器尚未提供 ACME webroot，需要先临时配置一个只监听 80 端口的 HTTP 站点。

### 2. 部署应用

```bash
cd /Users/liucai/Documents/极简个税/app
npm run deploy:ssr
```

脚本会：

1. 创建 `releases/<release-id>`、`shared` 和 `current` 目录。
2. 上传 `app/` 内容，排除依赖、构建产物和本地密钥。
3. 上传生产环境变量和 Nginx 配置。
4. 在服务器执行 `npm ci`。
5. 在切换版本前执行已提交的 Payload migration，然后构建并检查 standalone 入口。
6. 更新 `current` 软链接，创建或重启 `jijian-geshui.service`。
7. 做本机端口健康检查；失败时尝试恢复上一个 release。

不交互并在最后重载 Nginx：

```bash
npm run deploy:ssr -- --no-prompt --reload-nginx
```

只上传源码、环境变量和 Nginx 配置，不激活新版本：

```bash
npm run deploy:ssr -- --skip-build
```

### GitHub Actions 自动部署

`.github/workflows/deploy.yml` 会在 `main` 分支 push 或手动触发时执行 `app` 目录下的 lint、测试、类型检查和构建，并把 standalone 构建产物打包上传。检查通过后调用 `npm run deploy:ssr -- --artifact <release.zip>` 完成远程部署；服务器只安装运行依赖、执行数据库 migration、切换 release 和重启服务，不再重复执行 `npm run build`。

Workflow 使用 `registry.npmjs.org` 安装依赖，并关闭 npm audit/fund 请求；`app/package-lock.json` 也保持相同的官方 registry 地址，避免 GitHub Actions 运行器跨区域访问本地镜像时长时间无输出。安装脚本输出保持前台执行，便于定位具体依赖的安装进度。

如果 GitHub Actions 不可用，需要保留服务器构建作为兜底，可以在本地执行不带 `--artifact` 的部署命令：

```bash
cd /Users/liucai/Documents/极简个税/app
npm run deploy:ssr -- --no-prompt --reload-nginx
```

不带 `--artifact` 时，部署脚本会沿用服务器构建路径，在远程 release 中执行 `npm ci`、数据库 migration 和 `npm run build`。

请在 GitHub 仓库的 Settings → Secrets and variables → Actions 中配置以下 Repository secrets：

- `SSH_PRIVATE_KEY`：部署服务器 SSH 私钥，不要提交到仓库。
- `SSH_HOST`：部署服务器地址。
- `SSH_USER`：SSH 用户名。
- `SSH_PORT`：SSH 端口；不设置时使用 `27892`。
- `ENV_PRODUCTION`：完整的生产环境变量文件内容，至少包含 `DATABASE_URI` 和 `PAYLOAD_SECRET`；接入 Google Analytics 时再加入 `NEXT_PUBLIC_GA_MEASUREMENT_ID`。

以下 Repository variables 可选，不设置时使用当前部署脚本的默认值：

- `DEPLOY_PATH`：默认 `/www/wwwroot/jijian-geshui`。
- `NGINX_PATH`：默认 `/root/websites/nginx-config/conf/`。
- `APP_NAME`：默认 `jijian-geshui`。
- `APP_HOST`：默认 `127.0.0.1`。
- `APP_PORT`：默认 `30020`。
- `DOMAIN`：默认 `jijiangeshui.com`。
- `SITE_URL`：默认 `https://jijiangeshui.com`。

`ENV_PRODUCTION` 只在 Workflow 运行器和目标服务器之间传输，生产密钥不会写入 Git。首次启用后建议先通过 `workflow_dispatch` 手动执行一次，确认 SSH、数据库连接、migration、Nginx 和 systemd 服务均正常，再依赖 `main` 分支自动部署。

### 数据库迁移

修改 `app/src/collections` 后，开发者必须在本地生成并提交 migration：

```bash
cd /Users/liucai/Documents/极简个税/app
PAYLOAD_DB_PUSH=false npm run db:migration:create -- add_new_field
PAYLOAD_DB_PUSH=false npm run db:migrate
```

正式部署时，`deploy:ssr` 会在远程 release 目录中自动执行 `NODE_ENV=production npm run db:migrate`，成功后才构建并切换 `current`。已执行的 migration 不要修改，后续修复新增 migration。数据库迁移成功后若后续构建或重启失败，数据库不会自动回滚，应使用前向修复或人工恢复备份。

### 每日数据库备份

`deploy:ssr` 会自动安装并启用每日 00:00 的备份 service/timer，默认保留 15 天。已有服务器也可以使用 `app/ops/jijian-geshui-backup.service.example` 和 `.timer.example` 手动安装。安装后检查：

```bash
systemctl enable --now jijian-geshui-backup.timer
systemctl list-timers jijian-geshui-backup.timer
journalctl -u jijian-geshui-backup.service -n 100 --no-pager
```

## Nginx 与缓存

部署脚本会把 `app/ops/deploy/jijiangeshui.conf` 渲染后上传为：

```text
/root/websites/nginx-config/conf/jijiangeshui.conf
```

HTTPS 请求代理到 `127.0.0.1:30020`。`/_next/static/` 和 `/assets/` 都映射到当前 release，并设置 365 天浏览器缓存：`expires 365d`、`max-age=31536000`。

部署默认只上传配置，不自动重载。确认配置和证书存在后执行：

```bash
nginx -t && nginx -s reload
```

或者部署时传入 `--reload-nginx`。

## systemd 与回滚

```bash
systemctl status jijian-geshui --no-pager
systemctl restart jijian-geshui
journalctl -u jijian-geshui -n 200 --no-pager
```

应用以 standalone 产物启动：

```text
/www/wwwroot/jijian-geshui/current/.next/standalone/server.js
```

手动回滚：

```bash
cd /www/wwwroot/jijian-geshui
ls -1 releases
ln -sfn /www/wwwroot/jijian-geshui/releases/<可用版本号> current
systemctl restart jijian-geshui
```

## 上线检查

```bash
nginx -t
systemctl is-active jijian-geshui
curl -I https://jijiangeshui.com/
curl -I https://jijiangeshui.com/www-app-admin
journalctl -u jijian-geshui -n 100 --no-pager
```

重点确认首页、`/www-app-admin`、PostgreSQL 连接、证书续期、Nginx 日志和 `30020` 端口均正常，且不影响同服务器上的伊斯兰日历。

## 常见问题

- 证书失败：检查 DNS、80 端口、防火墙和 ACME webroot。
- Nginx 提示证书不存在：先生成证书，再执行 `nginx -t`。
- 服务启动失败：查看 `journalctl -u jijian-geshui -n 200 --no-pager`，重点检查 Node.js、数据库、密钥、standalone 文件和端口占用。
