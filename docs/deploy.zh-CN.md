# 极简个税部署说明

本文档对应 `app/scripts/deploy/deploy-ssr.mjs`、`app/scripts/deploy/jijiangeshui.conf` 和 `app/scripts/deploy/setup-ssl-acme.sh`，用于把极简个税部署到与伊斯兰日历相同的 Linux 服务器。

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

部署脚本默认读取 `app/.env`，上传前生成临时 `.env.production`，不会修改本地文件。至少需要提供真实的：

```dotenv
DATABASE_URI=postgres://用户名:密码@数据库地址:5432/jijian_geshui
PAYLOAD_SECRET=生产环境随机密钥
PAYLOAD_PREVIEW_SECRET=独立的预览密钥
NEXT_PUBLIC_SERVER_URL=https://jijiangeshui.com
```

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
4. 在服务器执行 `npm ci`、`npm run build`，并检查 standalone 入口。
5. 更新 `current` 软链接，创建或重启 `jijian-geshui.service`。
6. 做本机端口健康检查；失败时尝试恢复上一个 release。

不交互并在最后重载 Nginx：

```bash
npm run deploy:ssr -- --no-prompt --reload-nginx
```

只上传源码、环境变量和 Nginx 配置，不激活新版本：

```bash
npm run deploy:ssr -- --skip-build
```

## Nginx 与缓存

部署脚本会把 `app/scripts/deploy/jijiangeshui.conf` 渲染后上传为：

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
