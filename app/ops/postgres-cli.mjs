import { spawn } from 'node:child_process'

export function parseDatabaseUri(value) {
  if (!value) throw new Error('缺少 OPS_DATABASE_URI 或 DATABASE_URI。')

  const uri = new URL(value)
  if (!['postgres:', 'postgresql:'].includes(uri.protocol)) {
    throw new Error('数据库连接串必须是 PostgreSQL 连接串。')
  }

  const database = decodeURIComponent(uri.pathname.replace(/^\//u, ''))
  if (!database) throw new Error('数据库连接串缺少数据库名。')

  return {
    host: uri.hostname,
    port: uri.port || '5432',
    user: decodeURIComponent(uri.username),
    password: uri.password ? decodeURIComponent(uri.password) : undefined,
    database,
    sslmode: uri.searchParams.get('sslmode') || undefined,
  }
}

export function commandEnvironment(connection, extra = {}) {
  const environment = { ...process.env, ...extra }
  if (connection.password) environment.PGPASSWORD = connection.password
  if (connection.sslmode) environment.PGSSLMODE = connection.sslmode
  return environment
}

export function connectionArgs(connection, database = connection.database) {
  return [
    '--host', connection.host,
    '--port', connection.port,
    '--username', connection.user,
    '--dbname', database,
  ]
}

export function run(command, args, options = {}) {
  const { cwd, env = process.env, capture = false } = options
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    })
    let stdout = ''
    if (capture) child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(stdout)
      else reject(new Error(`${command} exited with code ${code}`))
    })
  })
}

export async function databaseExists(connection, database) {
  const escapedDatabase = database.replaceAll("'", "''")
  const result = await run('psql', [
    ...connectionArgs(connection, process.env.OPS_MAINTENANCE_DATABASE || 'postgres'),
    '--no-psqlrc',
    '--tuples-only',
    '--command', `SELECT 1 FROM pg_database WHERE datname = '${escapedDatabase}'`,
  ], { env: commandEnvironment(connection), capture: true })
  return result.trim() === '1'
}

export async function createDatabase(connection) {
  await run('createdb', [
    '--host', connection.host,
    '--port', connection.port,
    '--username', connection.user,
    '--maintenance-db', process.env.OPS_MAINTENANCE_DATABASE || 'postgres',
    '--owner', connection.user,
    connection.database,
  ], { env: commandEnvironment(connection) })
}

export async function dumpDatabase(connection, outputPath) {
  await run('pg_dump', [
    ...connectionArgs(connection),
    '--format=custom',
    '--no-owner',
    '--no-acl',
    '--file', outputPath,
  ], { env: commandEnvironment(connection) })
  await run('pg_restore', ['--list', outputPath], { env: commandEnvironment(connection) })
}

export async function restoreDatabase(connection, backupPath, { clean = false } = {}) {
  if (/\.sql$/iu.test(backupPath)) {
    await run('psql', [
      ...connectionArgs(connection),
      '--no-psqlrc',
      '--set', 'ON_ERROR_STOP=1',
      '--file', backupPath,
    ], { env: commandEnvironment(connection) })
    return
  }

  const cleanArgs = clean ? ['--clean', '--if-exists'] : []
  await run('pg_restore', [
    ...cleanArgs,
    ...connectionArgs(connection),
    '--no-owner',
    '--no-acl',
    '--exit-on-error',
    '--single-transaction',
    backupPath,
  ], { env: commandEnvironment(connection) })
}

export async function runMigrations(appRoot, connection) {
  await run('npm', ['run', 'db:migrate'], {
    cwd: appRoot,
    env: commandEnvironment(connection, {
      DATABASE_URI: process.env.OPS_DATABASE_URI || process.env.DATABASE_URI,
      NODE_ENV: 'production',
    }),
  })
}
