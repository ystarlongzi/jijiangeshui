#!/usr/bin/env node

import { access, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import {
  databaseExists,
  dumpDatabase,
  parseDatabaseUri,
  restoreDatabase,
  runMigrations,
} from './postgres-cli.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function optionValue(argv, option) {
  const index = argv.indexOf(option)
  if (index < 0 || !argv[index + 1]) throw new Error(`请提供 ${option} 参数。`)
  return path.resolve(argv[index + 1])
}

async function confirm(database) {
  const readline = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await readline.question(`将覆盖数据库 ${database}，请输入数据库名确认：`)
    return answer.trim() === database
  } finally {
    readline.close()
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const backupPath = optionValue(argv, '--backup')
  await access(backupPath)
  const connection = parseDatabaseUri(process.env.OPS_DATABASE_URI || process.env.DATABASE_URI)
  if (!(await databaseExists(connection, connection.database))) {
    throw new Error(`目标数据库 ${connection.database} 不存在，请先执行 db:init。`)
  }
  if (!(await confirm(connection.database))) {
    console.log('确认失败，未执行恢复。')
    return
  }

  const backupDir = path.resolve(process.env.BACKUP_DIR || path.join(appRoot, 'ops', 'backup'))
  await mkdir(backupDir, { recursive: true })
  const beforeRestore = path.join(backupDir, `before-restore-${new Date().toISOString().replace(/[:.]/gu, '-')}.dump`)
  console.log(`先备份当前远程数据库：${beforeRestore}`)
  await dumpDatabase(connection, beforeRestore)
  console.log(`恢复备份：${backupPath}`)
  await restoreDatabase(connection, backupPath, { clean: true })
  console.log('执行已提交的 Payload migrations。')
  await runMigrations(appRoot, connection)
  console.log(`数据库恢复完成：${connection.database}`)
}

main().catch((error) => {
  console.error(`数据库恢复失败：${error instanceof Error ? error.message : '未知错误'}`)
  process.exitCode = 1
})
