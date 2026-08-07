#!/usr/bin/env node

import { access, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import {
  databaseExists,
  dumpDatabase,
  filenameTimestamp,
  restoreDatabase,
  runMigrations,
} from './postgres-cli.mjs'
import { ui } from './output.mjs'
import { parseScriptOptions, resolveBackupPath, resolveDatabaseConnection } from './prompt.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

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
  ui.title('极简个税 · 数据库恢复')
  const argv = process.argv.slice(2)
  const options = parseScriptOptions(argv)
  const backupPath = await resolveBackupPath(argv, options)
  await access(backupPath)
  const connection = await resolveDatabaseConnection(options)
  if (!(await databaseExists(connection, connection.database))) {
    throw new Error(`目标数据库 ${connection.database} 不存在，请先执行 db:init。`)
  }
  const confirmedByEnvironment = process.env.OPS_CONFIRM_DATABASE === connection.database
  if (!options.yes && !confirmedByEnvironment && !(await confirm(connection.database))) {
    ui.warn('确认失败，未执行恢复。')
    return
  }

  const backupDir = path.resolve(process.env.BACKUP_DIR || path.join(appRoot, 'ops', 'backup'))
  await mkdir(backupDir, { recursive: true })
  const beforeRestore = path.join(backupDir, `jijian-geshui-before-restore-${filenameTimestamp()}.dump`)
  ui.step(`先备份当前远程数据库：${beforeRestore}`)
  await dumpDatabase(connection, beforeRestore)
  ui.step(`恢复备份：${backupPath}`)
  await restoreDatabase(connection, backupPath, { clean: true })
  ui.step('执行已提交的 Payload migrations。')
  await runMigrations(appRoot, connection)
  ui.success('数据库恢复完成，系统已经回到指定快照。')
}

main().catch((error) => {
  ui.error(`数据库恢复失败：${error instanceof Error ? error.message : '未知错误'}`)
  process.exitCode = 1
})
