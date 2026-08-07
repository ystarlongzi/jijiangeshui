# 运维目录

`app/ops` 集中存放数据库备份、数据库初始化、恢复和部署相关的运维入口，其中 `ops/deploy` 存放 SSR、SSL 和 Nginx 部署脚本。运维脚本只操作 `DATABASE_URI` 指定的项目数据库，不会遍历或修改同一 PostgreSQL 实例中的其他数据库。

运维命令从 `OPS_DATABASE_URI` 读取远程项目数据库连接串；未设置时回退到 `DATABASE_URI`。连接串的数据库名必须是项目目标库，例如：

```bash
export OPS_DATABASE_URI='postgresql://用户:密码@地址:5432/jijian_geshui?sslmode=require'
```

脚本会自动使用同一实例中默认的 `postgres` 数据库检查和创建目标库，不要求额外输入“维护数据库”。如果远程账号没有 `CREATEDB` 权限，需要先由管理员创建目标库。

手动执行时如果没有设置完整连接串，`db:init` 和 `db:restore` 会先询问 `PostgreSQL 地址`。这里支持两种输入方式：

- 输入完整连接串时，例如下面这样，脚本会直接解析，不再询问端口、用户和密码：

```text
postgresql://myuser:mypass@localhost:5432/jijian_geshui
```

- 只输入主机地址时，例如 `localhost` 或 `db.example.com`，脚本会继续询问端口、用户、数据库名、密码和 SSL 模式。

自动化环境建议直接使用 `OPS_DATABASE_URI`；也支持以下分项环境变量：

```dotenv
OPS_DB_HOST=数据库地址
OPS_DB_PORT=5432
OPS_DB_USER=数据库用户
OPS_DB_PASSWORD=数据库密码
OPS_DB_NAME=jijian_geshui
OPS_DB_SSLMODE=require
OPS_MAINTENANCE_DATABASE=postgres
OPS_BACKUP_FILE=/path/to/backup.dump
```

命令行参数优先级高于同名环境变量，例如 `--backup` 优先于 `OPS_BACKUP_FILE`。自动化环境可以设置 `OPS_NON_INTERACTIVE=true`；缺少必要值时命令会直接失败，不会卡在输入提示中。

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
# 没有环境变量时，会交互询问连接参数和备份路径
npm run db:init

# 也可以提前提供远程连接和备份路径
OPS_DATABASE_URI='postgresql://用户:密码@地址:5432/jijian_geshui?sslmode=require' \
OPS_BACKUP_FILE=/path/to/local-backup.dump \
npm run db:init

# 自动化模式：缺少值直接失败
OPS_NON_INTERACTIVE=true \
OPS_DATABASE_URI='postgresql://用户:密码@地址:5432/jijian_geshui?sslmode=require' \
OPS_BACKUP_FILE=/path/to/local-backup.dump \
npm run db:init -- --non-interactive

# 目标数据库不存在时，创建数据库、恢复备份并执行 migration
npm run db:init -- --backup /path/to/local-backup.dump
```

目标数据库已存在时，命令会退出并且不会执行恢复。目标数据库不存在时，命令会创建数据库、恢复备份，并执行已提交的 migration。

恢复已有数据库：

```bash
# 人工执行时会要求输入目标数据库名确认
npm run db:restore -- --backup /path/to/local-backup.dump

# 自动化调用必须显式确认，避免误覆盖
OPS_CONFIRM_DATABASE=jijian_geshui \
OPS_NON_INTERACTIVE=true \
npm run db:restore -- --backup /path/to/local-backup.dump --non-interactive --yes
```

该命令要求输入目标数据库名确认，恢复前会先备份当前远程数据库。执行前应停止应用写入；恢复失败时不自动删除目标库，保留现场供排查。

## 数据库备份

备份脚本使用 PostgreSQL 原生 `pg_dump`，只备份 `OPS_DATABASE_URI` 或 `DATABASE_URI` 指定的数据库，默认目录为 `app/ops/backup`，默认保留 15 天。手动在终端执行时，缺少连接环境变量会交互询问；systemd 定时任务没有终端，缺少连接环境变量时会直接失败：

```bash
cd /Users/liucai/Documents/极简个税/app
DATABASE_URI='postgresql://用户:密码@地址:5432/jijian_geshui?sslmode=require' \
BACKUP_DIR=/tmp/jijian-geshui-backups \
npm run ops:backup
```

备份文件名格式为：

```text
jijian-geshui-YYYYMMDD-HHmmss.dump
```

例如：

```text
jijian-geshui-20260807-000000.dump
```

在支持颜色的终端中，成功消息使用绿色显示，步骤、警告和失败分别使用青色、黄色和红色；systemd 定时任务默认不输出 ANSI 颜色控制符，便于查看日志。

恢复已有数据库前生成的保护性备份使用：

```text
jijian-geshui-before-restore-YYYYMMDD-HHmmss.dump
```

脚本不会把密码写入命令参数；密码只通过子进程环境变量传给 PostgreSQL 客户端。生产环境建议使用服务器上的受限目录，例如 `/var/backups/jijian-geshui`，并将备份复制到另一台机器或对象存储。

手动执行时也可以直接运行，缺少连接信息会询问：

```bash
npm run ops:backup
```

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
