#!/usr/bin/env node

import { access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createDatabase,
  databaseExists,
  restoreDatabase,
  runMigrations,
} from './postgres-cli.mjs'
import { ui } from './output.mjs'
import { parseScriptOptions, resolveBackupPath, resolveDatabaseConnection } from './prompt.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function main() {
  ui.title('极简个税 · 首次数据库初始化')
  const argv = process.argv.slice(2)
  const options = parseScriptOptions(argv)
  const backupPath = await resolveBackupPath(argv, options)
  await access(backupPath)

  const connection = await resolveDatabaseConnection(options)
  ui.step(`检查目标数据库：${connection.database}`)
  if (await databaseExists(connection, connection.database)) {
    ui.error(`目标数据库 ${connection.database} 已存在。为避免覆盖，初始化已终止。`)
    process.exitCode = 2
    return
  }

  ui.step(`创建目标数据库：${connection.database}`)
  await createDatabase(connection)
  ui.step(`恢复备份：${backupPath}`)
  await restoreDatabase(connection, backupPath)
  ui.step('执行已提交的 Payload migrations。')
  await runMigrations(appRoot, connection)
  ui.success('数据库初始化完成，新的环境已经准备就绪。')
}

main().catch((error) => {
  ui.error(`数据库初始化失败：${error instanceof Error ? error.message : '未知错误'}`)
  process.exitCode = 1
})
