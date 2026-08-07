#!/usr/bin/env node

import { mkdir, readdir, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { commandEnvironment, connectionArgs, filenameTimestamp, run } from './postgres-cli.mjs'
import { ui } from './output.mjs'
import { parseScriptOptions, resolveDatabaseConnection } from './prompt.mjs'

const defaultRetentionDays = 15
const backupPrefix = 'jijian-geshui'
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function fail(message) {
  ui.error(`数据库备份失败：${message}`)
  process.exitCode = 1
}

function parseOptions(argv) {
  const options = {
    backupDir: process.env.BACKUP_DIR || path.join(appRoot, 'ops', 'backup'),
    retentionDays: Number(process.env.BACKUP_RETENTION_DAYS || defaultRetentionDays),
    dryRun: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--non-interactive' || arg === '--yes') continue
    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }
    if (arg === '--backup-dir') {
      options.backupDir = path.resolve(argv[++index] || '')
      continue
    }
    if (arg === '--retention-days') {
      options.retentionDays = Number(argv[++index])
      continue
    }
    throw new Error(`未知参数：${arg}`)
  }

  if (!Number.isInteger(options.retentionDays) || options.retentionDays < 1) {
    throw new Error('保留天数必须是大于 0 的整数。')
  }

  return options
}

async function removeExpiredBackups(backupDir, retentionDays) {
  const expireAt = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  const names = await readdir(backupDir)

  for (const name of names) {
    if (!new RegExp(`^${backupPrefix}-(?:before-restore-)?\\d{8}-\\d{6}\\.dump$`, 'u').test(name)) continue
    const filePath = path.join(backupDir, name)
    const fileStat = await stat(filePath)
    if (fileStat.mtimeMs < expireAt) {
      await unlink(filePath)
      ui.info(`已删除过期备份：${filePath}`)
    }
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const scriptOptions = parseScriptOptions(argv)
  const options = parseOptions(argv)
  const connection = await resolveDatabaseConnection(scriptOptions)
  await mkdir(options.backupDir, { recursive: true })

  const outputPath = path.join(options.backupDir, `${backupPrefix}-${filenameTimestamp()}.dump`)
  const environment = commandEnvironment(connection)
  const args = [
    ...connectionArgs(connection),
    '--format=custom',
    '--no-owner',
    '--no-acl',
    '--file', outputPath,
  ]

  ui.title('极简个税 · 数据库备份')
  ui.step(`目标数据库：${connection.database}`)
  ui.step(`备份文件：${outputPath}`)
  if (!options.dryRun) {
    await run('pg_dump', args, { env: environment })
    await run('pg_restore', ['--list', outputPath], { env: environment })
    ui.success('数据库备份完成，数据已稳稳落袋。')
  } else {
    ui.warn(`演练模式，不执行 pg_dump：${outputPath}`)
  }

  if (!options.dryRun) await removeExpiredBackups(options.backupDir, options.retentionDays)
}

main().catch((error) => fail(error instanceof Error ? error.message : '未知错误'))
