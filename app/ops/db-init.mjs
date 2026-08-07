#!/usr/bin/env node

import { access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createDatabase,
  databaseExists,
  parseDatabaseUri,
  restoreDatabase,
  runMigrations,
} from './postgres-cli.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function parseBackupPath(argv) {
  const index = argv.indexOf('--backup')
  if (index < 0 || !argv[index + 1]) throw new Error('请提供 --backup 备份文件路径。')
  return path.resolve(argv[index + 1])
}

async function main() {
  const backupPath = parseBackupPath(process.argv.slice(2))
  await access(backupPath)

  const connection = parseDatabaseUri(process.env.OPS_DATABASE_URI || process.env.DATABASE_URI)
  console.log(`检查目标数据库：${connection.database}`)
  if (await databaseExists(connection, connection.database)) {
    console.error(`目标数据库 ${connection.database} 已存在。为避免覆盖，初始化已终止。`)
    process.exitCode = 2
    return
  }

  console.log(`创建目标数据库：${connection.database}`)
  await createDatabase(connection)
  console.log(`恢复备份：${backupPath}`)
  await restoreDatabase(connection, backupPath)
  console.log('执行已提交的 Payload migrations。')
  await runMigrations(appRoot, connection)
  console.log(`数据库初始化完成：${connection.database}`)
}

main().catch((error) => {
  console.error(`数据库初始化失败：${error instanceof Error ? error.message : '未知错误'}`)
  process.exitCode = 1
})
