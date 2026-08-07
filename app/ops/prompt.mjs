import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { parseDatabaseUri } from './postgres-cli.mjs'

function isTruthy(value) {
  return /^(?:1|true|yes)$/iu.test(String(value || ''))
}

function requireInteractive(nonInteractive, action) {
  if (nonInteractive || !process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(`${action}缺少环境变量，且当前不是可交互终端。请补齐 OPS_DATABASE_URI、OPS_BACKUP_FILE，或移除 --non-interactive。`)
  }
}

async function promptText(label, defaultValue = '') {
  const readline = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const suffix = defaultValue ? ` [${defaultValue}]` : ''
    const answer = (await readline.question(`${label}${suffix}: `)).trim()
    return answer || defaultValue
  } finally {
    readline.close()
  }
}

async function promptSecret(label) {
  if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error(`${label}需要交互式终端，或通过环境变量提供。`)
  }

  return new Promise((resolve, reject) => {
    let value = ''
    const onData = (chunk) => {
      const input = chunk.toString()
      for (const character of input) {
        if (character === '\u0003') {
          cleanup()
          reject(new Error('用户取消输入。'))
          return
        }
        if (character === '\r' || character === '\n') {
          cleanup()
          process.stdout.write('\n')
          resolve(value)
          return
        }
        if (character === '\u007f') {
          value = value.slice(0, -1)
        } else {
          value += character
        }
      }
    }
    const cleanup = () => {
      process.stdin.removeListener('data', onData)
      process.stdin.setRawMode(false)
      process.stdin.pause()
    }

    process.stdout.write(`${label}: `)
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', onData)
  })
}

export function parseScriptOptions(argv) {
  return {
    nonInteractive: argv.includes('--non-interactive') || isTruthy(process.env.OPS_NON_INTERACTIVE),
    yes: argv.includes('--yes'),
  }
}

export async function resolveDatabaseConnection({ nonInteractive }) {
  const configuredUri = process.env.OPS_DATABASE_URI || process.env.DATABASE_URI
  if (configuredUri) return parseDatabaseUri(configuredUri)

  const configuredHost = process.env.OPS_DB_HOST
  const configuredPort = process.env.OPS_DB_PORT || '5432'
  const configuredUser = process.env.OPS_DB_USER
  const configuredDatabase = process.env.OPS_DB_NAME || 'jijian_geshui'
  if (configuredHost && configuredUser) {
    return {
      host: configuredHost,
      port: configuredPort,
      user: configuredUser,
      password: process.env.OPS_DB_PASSWORD,
      database: configuredDatabase,
      sslmode: process.env.OPS_DB_SSLMODE || undefined,
    }
  }

  requireInteractive(nonInteractive, '数据库连接')
  const address = await promptText(
    'PostgreSQL 地址（可输入完整连接串）',
    process.env.OPS_DB_HOST,
  )
  if (!address) throw new Error('PostgreSQL 地址不能为空。')
  if (/^postgres(?:ql)?:\/\//iu.test(address)) return parseDatabaseUri(address)

  const port = await promptText('PostgreSQL 端口', process.env.OPS_DB_PORT || '5432')
  const user = await promptText('数据库用户', process.env.OPS_DB_USER)
  const database = await promptText('目标数据库名', process.env.OPS_DB_NAME || 'jijian_geshui')
  const password = process.env.OPS_DB_PASSWORD ?? await promptSecret('数据库密码')
  const sslmode = await promptText('SSL 模式', process.env.OPS_DB_SSLMODE || 'prefer')

  if (!port || !user || !database) throw new Error('端口、用户和数据库名不能为空。')
  return { host: address, port, user, password, database, sslmode: sslmode || undefined }
}

export async function resolveBackupPath(argv, { nonInteractive }) {
  const index = argv.indexOf('--backup')
  if (index >= 0) {
    if (!argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error('--backup 缺少文件路径。')
    return path.resolve(argv[index + 1])
  }

  if (process.env.OPS_BACKUP_FILE) return path.resolve(process.env.OPS_BACKUP_FILE)
  requireInteractive(nonInteractive, '备份文件')
  const backupPath = await promptText('备份文件路径')
  if (!backupPath) throw new Error('备份文件路径不能为空。')
  return path.resolve(backupPath)
}
