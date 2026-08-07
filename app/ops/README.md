# 运维目录

`app/ops` 集中存放数据库备份、数据库初始化、恢复和部署相关的运维入口，其中 `ops/deploy` 存放 SSR、SSL 和 Nginx 部署脚本。运维脚本只操作 `DATABASE_URI` 指定的项目数据库，不会遍历或修改同一 PostgreSQL 实例中的其他数据库。

运维命令从 `OPS_DATABASE_URI` 读取远程项目数据库连接串；未设置时回退到 `DATABASE_URI`。连接串的数据库名必须是项目目标库，例如：

```bash
export OPS_DATABASE_URI='postgresql://用户:密码@地址:5432/jijian_geshui?sslmode=require'
```

脚本会自动使用同一实例中默认的 `postgres` 数据库检查和创建目标库，不要求额外输入“维护数据库”。如果远程账号没有 `CREATEDB` 权限，需要先由管理员创建目标库。

## 数据库结构变更约定

修改 `src/collections` 中的 Collection、新增 Collection 或修改字段后，必须在本地生成并提交 Payload migration：

```bash
cd /Users/liucai/Documents/极简个税/app
PAYLOAD_DB_PUSH=false npm run db:migration:create -- add_tax_rule_field
PAYLOAD_DB_PUSH=false npm run db:migrate
PAYLOAD_DB_PUSH=false npm run db:migrate:status
```

`db:migration:create` 只由开发者在本地执行，生成文件到 `src/migrations/`。已经执行过的 migration 不得修改；修复应新增一条 migration。
本项目开发环境默认保留 Payload 自动推送能力；生成 migration 时必须设置 `PAYLOAD_DB_PUSH=false`。

部署流程会在切换新版本前，在远程数据库执行：

```bash
NODE_ENV=production npm run db:migrate
```

新增文章、FAQ、城市规则等内容属于数据变更，不生成 migration，应使用 Payload 后台或现有导入脚本。

首次初始化：

```bash
npm run db:init -- --backup /path/to/local-backup.dump
```

目标数据库已存在时，命令会退出并且不会执行恢复。目标数据库不存在时，命令会创建数据库、恢复备份，并执行已提交的 migration。

恢复已有数据库：

```bash
npm run db:restore -- --backup /path/to/local-backup.dump
```

该命令要求输入目标数据库名确认，恢复前会先备份当前远程数据库。执行前应停止应用写入；恢复失败时不自动删除目标库，保留现场供排查。

## 数据库备份

备份脚本使用 PostgreSQL 原生 `pg_dump`，只备份 `DATABASE_URI` 指定的数据库，默认目录为 `app/ops/backup`，默认保留 15 天：

```bash
cd /Users/liucai/Documents/极简个税/app
DATABASE_URI='postgresql://用户:密码@地址:5432/jijian_geshui?sslmode=require' \
BACKUP_DIR=/tmp/jijian-geshui-backups \
npm run ops:backup
```

脚本不会把密码写入命令参数；密码只通过子进程环境变量传给 PostgreSQL 客户端。生产环境建议使用服务器上的受限目录，例如 `/var/backups/jijian-geshui`，并将备份复制到另一台机器或对象存储。

演练参数检查：

```bash
npm run ops:backup -- --dry-run
```

生产服务器通过 `deploy:ssr` 部署时会自动安装并启用每日 00:00 的定时器。已有服务器手动安装：

```bash
cp ops/jijian-geshui-backup.service.example /etc/systemd/system/jijian-geshui-backup.service
cp ops/jijian-geshui-backup.timer.example /etc/systemd/system/jijian-geshui-backup.timer
systemctl daemon-reload
systemctl enable --now jijian-geshui-backup.timer
systemctl list-timers jijian-geshui-backup.timer
```

备份失败或定时器异常时，查看：

```bash
journalctl -u jijian-geshui-backup.service -n 100 --no-pager
```

## 备份与恢复原则

- 首次初始化只能创建不存在的目标数据库；发现目标数据库已存在时必须退出，不自动覆盖。
- 恢复已有数据库前，先生成一份当前远程数据库备份。
- 首次恢复空库时，`.dump` 使用 `pg_restore`，纯文本 `.sql` 使用 `psql`；已有库的覆盖恢复优先使用本项目生成的 `.dump`，避免普通 `.sql` 因没有删除语句而留下旧数据。
- 不在生产环境使用 `payload migrate:fresh`、`migrate:reset` 或删除整个数据库。
