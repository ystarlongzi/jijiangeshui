#!/usr/bin/env node

import { mkdir, readdir, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const defaultRetentionDays = 15
const backupPrefix = 'jijian-geshui'
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function fail(message) {
  console.error(`数据库备份失败：${message}`)
  process.exitCode = 1
}

function parseDatabaseUri(value) {
  if (!value) throw new Error('缺少 DATABASE_URI。')

  const uri = new URL(value)
  if (!['postgres:', 'postgresql:'].includes(uri.protocol)) {
    throw new Error('DATABASE_URI 必须是 PostgreSQL 连接串。')
  }

  const database = decodeURIComponent(uri.pathname.replace(/^\//u, ''))
  if (!database) throw new Error('DATABASE_URI 缺少数据库名。')

  return {
    host: uri.hostname,
    port: uri.port || '5432',
    user: decodeURIComponent(uri.username),
    password: uri.password ? decodeURIComponent(uri.password) : undefined,
    database,
    sslmode: uri.searchParams.get('sslmode') || undefined,
  }
}

function parseOptions(argv) {
  const options = {
    backupDir: process.env.BACKUP_DIR || path.join(appRoot, 'ops', 'backup'),
    retentionDays: Number(process.env.BACKUP_RETENTION_DAYS || defaultRetentionDays),
    dryRun: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
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

function commandEnvironment(connection) {
  const environment = { ...process.env }
  if (connection.password) environment.PGPASSWORD = connection.password
  if (connection.sslmode) environment.PGSSLMODE = connection.sslmode
  return environment
}

function run(command, args, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: environment,
      stdio: 'inherit',
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with code ${code}`))
    })
  })
}

function connectionArgs(connection) {
  return [
    '--host', connection.host,
    '--port', connection.port,
    '--username', connection.user,
    '--dbname', connection.database,
  ]
}

function timestamp() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

async function removeExpiredBackups(backupDir, retentionDays) {
  const expireAt = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  const names = await readdir(backupDir)

  for (const name of names) {
    if (!new RegExp(`^${backupPrefix}-\\d{8}-\\d{6}\\.dump$`, 'u').test(name)) continue
    const filePath = path.join(backupDir, name)
    const fileStat = await stat(filePath)
    if (fileStat.mtimeMs < expireAt) {
      await unlink(filePath)
      console.log(`已删除过期备份：${filePath}`)
    }
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2))
  const connection = parseDatabaseUri(process.env.DATABASE_URI)
  await mkdir(options.backupDir, { recursive: true })

  const outputPath = path.join(options.backupDir, `${backupPrefix}-${timestamp()}.dump`)
  const environment = commandEnvironment(connection)
  const args = [
    ...connectionArgs(connection),
    '--format=custom',
    '--no-owner',
    '--no-acl',
    '--file', outputPath,
  ]

  console.log(`开始备份数据库 ${connection.database} 到 ${outputPath}`)
  if (!options.dryRun) {
    await run('pg_dump', args, environment)
    await run('pg_restore', ['--list', outputPath], environment)
    console.log(`数据库备份完成：${outputPath}`)
  } else {
    console.log(`演练模式，不执行 pg_dump：${outputPath}`)
  }

  if (!options.dryRun) await removeExpiredBackups(options.backupDir, options.retentionDays)
}

main().catch((error) => fail(error instanceof Error ? error.message : '未知错误'))
