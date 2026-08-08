#!/usr/bin/env node

import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

const deployDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(deployDir, '..', '..')
const tempRoot = path.join(appRoot, '.deploy-tmp')

const defaults = {
  host: '185.186.146.217',
  user: 'root',
  sshPort: '27892',
  key: '~/.ssh/id_ed25519',
  deployPath: '/www/wwwroot/jijian-geshui',
  nginxPath: '/root/websites/nginx-config/conf/',
  appName: 'jijian-geshui',
  appHost: '127.0.0.1',
  appPort: '30020',
  domain: 'jijiangeshui.com',
  siteUrl: 'https://jijiangeshui.com',
}

const releaseRetention = 2
const minimumFreeKilobytes = 1024 * 1024
const minimumFreeInodes = 100000

function printHelp() {
  console.log(`Usage: npm run deploy:ssr -- [options]

Options:
  --host <ip>               Server IP or hostname
  --user <name>             SSH user
  --ssh-port <port>         SSH port (alias: --port)
  --key <path>              SSH private key path
  --deploy-path <path>      Remote deploy root
  --nginx-path <path>       Remote Nginx config directory
  --app-name <name>         Systemd service name
  --app-host <host>         Local Next.js listen host
  --app-port <port>         Local Next.js listen port
  --domain <domain>         Public domain used by Nginx and SSL
  --site-url <url>          Public site URL injected into production env
  --env-file <path>         Local env file to upload (default: app/.env.production)
  --artifact <path>         Prebuilt release zip; skip remote build
  --skip-build              Upload source, env and Nginx config only
  --reload-nginx            Run nginx -t and reload Nginx after activation
  --no-prompt               Do not ask for deployment parameters
  --help                    Show this help
`)
}

function parseArgs(argv) {
  const options = { ...defaults, envFile: path.join(appRoot, '.env.production'), artifact: null, skipBuild: false, reloadNginx: false, noPrompt: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help') { options.help = true; continue }
    if (arg === '--skip-build') { options.skipBuild = true; continue }
    if (arg === '--reload-nginx') { options.reloadNginx = true; continue }
    if (arg === '--no-prompt') { options.noPrompt = true; continue }
    if (!arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`)
    const key = arg.slice(2)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`)
    index += 1
    switch (key) {
      case 'host': options.host = value; break
      case 'user': options.user = value; break
      case 'ssh-port':
      case 'port': options.sshPort = value; break
      case 'key': options.key = value; break
      case 'deploy-path': options.deployPath = value; break
      case 'nginx-path': options.nginxPath = value; break
      case 'app-name': options.appName = value; break
      case 'app-host': options.appHost = value; break
      case 'app-port': options.appPort = value; break
      case 'domain': options.domain = value; break
      case 'site-url': options.siteUrl = value; break
      case 'env-file': options.envFile = path.resolve(appRoot, value); break
      case 'artifact': options.artifact = path.resolve(appRoot, value); break
      default: throw new Error(`Unknown option: --${key}`)
    }
  }
  return options
}

async function promptOptions(options) {
  const readline = createInterface({ input: process.stdin, output: process.stdout })
  const ask = async (label, currentValue) => (await readline.question(`${label} [${currentValue}]: `)).trim() || currentValue
  try {
    options.host = await ask('Host', options.host)
    options.user = await ask('User', options.user)
    options.sshPort = await ask('SSH port', options.sshPort)
    options.deployPath = await ask('Deploy path', options.deployPath)
    options.nginxPath = await ask('Nginx config path', options.nginxPath)
    options.appPort = await ask('App port', options.appPort)
    options.siteUrl = await ask('Site URL', options.siteUrl)
    options.reloadNginx = /^(?:y|yes)$/iu.test((await readline.question('Reload Nginx after deployment? [y/N]: ')).trim())
  } finally { readline.close() }
}

function expandHome(value) { return value.startsWith('~/') ? path.join(os.homedir(), value.slice(2)) : value }
function shellQuote(value) { return `'${String(value).replaceAll("'", `'\\''`)}'` }
function ensurePort(value, label) {
  if (!/^\d+$/u.test(value) || Number(value) < 1 || Number(value) > 65535) throw new Error(`${label} must be between 1 and 65535.`)
  return String(Number(value))
}
function normalizeRemotePath(value, label) {
  const normalized = path.posix.normalize(value)
  if (!normalized.startsWith('/') || normalized === '/') throw new Error(`${label} must be an absolute path.`)
  return normalized
}
function validateServiceName(value) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/u.test(value)) throw new Error('App name contains unsupported characters.')
  return value
}
function validateDomain(value) {
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/iu.test(value)) throw new Error('Domain is invalid.')
  return value.toLowerCase()
}
function normalizeSiteUrl(value) {
  const parsed = new URL(value)
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error('Site URL must be an http(s) origin without a path, query or hash.')
  return value.replace(/\/$/u, '')
}
function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: appRoot, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)))
  })
}
async function ensureFileExists(filePath, description) {
  try { await access(filePath, constants.F_OK) } catch { throw new Error(`${description} not found: ${filePath}`) }
}
function readEnvValues(content) {
  const values = {}
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator < 0) continue
    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    values[key] = value
  }
  return values
}
function renderProductionEnv(content, siteUrl) {
  let serverUrlReplaced = false
  let siteUrlReplaced = false
  const lines = content.split(/\r?\n/u).map((line) => {
    const match = line.match(/^\s*(NEXT_PUBLIC_(?:SERVER|SITE)_URL)\s*=/u)
    if (!match) return line
    if (match[1] === 'NEXT_PUBLIC_SITE_URL') siteUrlReplaced = true
    else serverUrlReplaced = true
    return `${match[1]}=${siteUrl}`
  })
  if (!serverUrlReplaced) lines.push(`NEXT_PUBLIC_SERVER_URL=${siteUrl}`)
  if (!siteUrlReplaced) lines.push(`NEXT_PUBLIC_SITE_URL=${siteUrl}`)
  return `${lines.join('\n').replace(/\n*$/u, '')}\n`
}
function renderNginxConfig(template, options) {
  return template.replaceAll('__DOMAIN__', options.domain).replaceAll('__APP_PORT__', options.appPort).replaceAll('__DEPLOY_PATH__', options.deployPath)
}
async function prepareTempFiles(options, envContent) {
  await mkdir(tempRoot, { recursive: true })
  const envPath = path.join(tempRoot, 'env.production')
  const nginxPath = path.join(tempRoot, 'jijiangeshui.conf')
  const template = await readFile(path.join(deployDir, 'jijiangeshui.conf'), 'utf8')
  await writeFile(envPath, renderProductionEnv(envContent, options.siteUrl), { encoding: 'utf8', mode: 0o600 })
  await writeFile(nginxPath, renderNginxConfig(template, options), { encoding: 'utf8', mode: 0o644 })
  return { envPath, nginxPath }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) { printHelp(); return }
  if (!options.noPrompt) await promptOptions(options)
  options.key = expandHome(options.key)
  options.sshPort = ensurePort(options.sshPort, 'SSH port')
  options.appPort = ensurePort(options.appPort, 'App port')
  options.deployPath = normalizeRemotePath(options.deployPath, 'Deploy path')
  options.nginxPath = normalizeRemotePath(options.nginxPath, 'Nginx config path')
  options.appName = validateServiceName(options.appName)
  options.domain = validateDomain(options.domain)
  options.siteUrl = normalizeSiteUrl(options.siteUrl)
  if (options.skipBuild && options.artifact) throw new Error('--artifact cannot be used with --skip-build.')
  await ensureFileExists(options.key, 'SSH private key')
  await ensureFileExists(path.join(appRoot, 'package.json'), 'package.json')
  await ensureFileExists(options.envFile, 'Env file')
  if (options.artifact) await ensureFileExists(options.artifact, 'Build artifact')
  const envContent = await readFile(options.envFile, 'utf8')
  const envValues = readEnvValues(envContent)
  for (const key of ['DATABASE_URI', 'PAYLOAD_SECRET']) if (!envValues[key]) throw new Error(`${key} must be set in the env file.`)

  const sshTarget = `${options.user}@${options.host}`
  const sshArgs = ['-i', options.key, '-p', options.sshPort, '-o', 'StrictHostKeyChecking=accept-new']
  const releaseId = new Date().toISOString().replace(/\D/gu, '').slice(0, 17)
  const remoteReleaseRoot = path.posix.join(options.deployPath, 'releases')
  const remoteRelease = path.posix.join(remoteReleaseRoot, releaseId)
  const remoteCurrent = path.posix.join(options.deployPath, 'current')
  const remoteEnv = path.posix.join(options.deployPath, 'shared', '.env.production')
  const remoteNginx = path.posix.join(options.nginxPath, 'jijiangeshui.conf')
  const remoteService = `/etc/systemd/system/${options.appName}.service`
  const remoteArtifact = path.posix.join('/tmp', `${options.appName}-${releaseId}.zip`)
  const backupServiceName = `${options.appName}-backup`
  const remoteBackupService = `/etc/systemd/system/${backupServiceName}.service`
  const remoteBackupTimer = `/etc/systemd/system/${backupServiceName}.timer`
  const tempFiles = await prepareTempFiles(options, envContent)
  const remoteCleanupOnExit = [
    'cleanup_deployment_artifacts() {',
    '  status=$?',
    `  if [ "$status" -ne 0 ]; then rm -rf -- ${shellQuote(remoteRelease)} || true; fi`,
    `  rm -f -- ${shellQuote(remoteArtifact)} || true`,
    '  exit "$status"',
    '}',
    'trap cleanup_deployment_artifacts EXIT',
  ].join('\n')
  const remoteMaintenance = [
    `current_target="$(readlink -f ${shellQuote(remoteCurrent)} 2>/dev/null || true)"`,
    'kept_releases=0',
    `find ${shellQuote(remoteReleaseRoot)} -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\\n' 2>/dev/null | sort -rn | while IFS= read -r release_entry; do`,
    '  candidate="${release_entry#* }"',
    `  [ "$candidate" = ${shellQuote(remoteRelease)} ] && continue`,
    '  [ "$candidate" = "$current_target" ] && continue',
    '  kept_releases=$((kept_releases + 1))',
    `  if [ "$kept_releases" -gt ${releaseRetention} ]; then rm -rf -- "$candidate"; fi`,
    'done',
    `find /tmp -maxdepth 1 -type f -name ${shellQuote(`${options.appName}-*.zip`)} -mtime +1 -delete 2>/dev/null || true`,
    `available_kb="$(df -Pk ${shellQuote(remoteRelease)} | awk 'NR == 2 { print $4 }')"`,
    `available_inodes="$(df -Pi ${shellQuote(remoteRelease)} | awk 'NR == 2 { print $4 }')"`,
    'case "$available_kb" in ""|*[!0-9]*) echo "Unable to determine free disk space." >&2; exit 1;; esac',
    'case "$available_inodes" in ""|*[!0-9]*) echo "Unable to determine free inodes." >&2; exit 1;; esac',
    `if [ "$available_kb" -lt ${minimumFreeKilobytes} ] && command -v npm >/dev/null 2>&1; then npm cache clean --force --silent >/dev/null 2>&1 || true; available_kb="$(df -Pk ${shellQuote(remoteRelease)} | awk 'NR == 2 { print $4 }')"; fi`,
    `if [ "$available_kb" -lt ${minimumFreeKilobytes} ] || [ "$available_inodes" -lt ${minimumFreeInodes} ]; then echo "Insufficient remote capacity before install: available $available_kb KB / $available_inodes inodes; required ${minimumFreeKilobytes} KB / ${minimumFreeInodes} inodes." >&2; df -h ${shellQuote(remoteRelease)} >&2; df -i ${shellQuote(remoteRelease)} >&2; exit 1; fi`,
  ].join('\n')

  try {
    console.log(`[1/6] Preparing remote directories on ${sshTarget}`)
    await runCommand('ssh', [...sshArgs, sshTarget, [
      'set -euo pipefail',
      `mkdir -p ${shellQuote(remoteRelease)} ${shellQuote(path.posix.join(options.deployPath, 'releases'))} ${shellQuote(path.posix.join(options.deployPath, 'shared'))} ${shellQuote(options.nginxPath)}`,
      remoteMaintenance,
    ].join('\n')])

    if (options.artifact) {
      console.log(`[2/6] Uploading prebuilt release artifact to ${remoteRelease}`)
      await runCommand('scp', ['-i', options.key, '-P', options.sshPort, '-o', 'StrictHostKeyChecking=accept-new', options.artifact, `${sshTarget}:${remoteArtifact}`])
    } else {
      console.log(`[2/6] Uploading app source to ${remoteRelease}`)
      const rsyncSsh = `ssh -i ${shellQuote(options.key)} -p ${shellQuote(options.sshPort)} -o StrictHostKeyChecking=accept-new`
      await runCommand('rsync', ['-az', '--delete', '--exclude', '.git', '--exclude', '.next', '--exclude', 'node_modules', '--exclude', '.deploy-tmp', '--exclude', '.env', '--exclude', '.env.*', '--exclude', '.DS_Store', '--exclude', 'tsconfig.tsbuildinfo', '--exclude', 'ops/backup', '-e', rsyncSsh, `${appRoot}/`, `${sshTarget}:${remoteRelease}/`])
    }

    console.log('[3/6] Uploading environment file')
    await runCommand('scp', ['-i', options.key, '-P', options.sshPort, '-o', 'StrictHostKeyChecking=accept-new', tempFiles.envPath, `${sshTarget}:${remoteEnv}`])
    console.log(`[4/6] Uploading Nginx config to ${remoteNginx}`)
    await runCommand('scp', ['-i', options.key, '-P', options.sshPort, '-o', 'StrictHostKeyChecking=accept-new', tempFiles.nginxPath, `${sshTarget}:${remoteNginx}`])
    if (options.skipBuild) { console.log('Source, environment and Nginx config uploaded. Build and activation skipped.'); return }

    const previousCurrent = `previous_current="$(readlink -f ${shellQuote(remoteCurrent)} 2>/dev/null || true)"`
    const rollback = [
      'if [ -n "$previous_current" ]; then',
      `  ln -sfn "$previous_current" ${shellQuote(remoteCurrent)}`,
      `  systemctl restart ${shellQuote(options.appName)} || true`,
      'fi',
    ].join('\n')
    const serviceUnit = `[Unit]\nDescription=Jijian Geshui Next.js application\nAfter=network.target\n\n[Service]\nType=simple\nWorkingDirectory=${remoteCurrent}\nEnvironment=NODE_ENV=production\nEnvironment=PORT=${options.appPort}\nEnvironment=HOSTNAME=${options.appHost}\nEnvironmentFile=${remoteEnv}\nExecStart=/usr/bin/env node .next/standalone/server.js\nRestart=always\nRestartSec=5\nUser=root\n\n[Install]\nWantedBy=multi-user.target\n`
    const backupServiceUnit = `[Unit]\nDescription=Jijian Geshui PostgreSQL backup\nAfter=network-online.target\nWants=network-online.target\n\n[Service]\nType=oneshot\nUser=root\nWorkingDirectory=${remoteCurrent}\nEnvironmentFile=${remoteEnv}\nEnvironment=BACKUP_DIR=/var/backups/${options.appName}\nEnvironment=BACKUP_RETENTION_DAYS=15\nExecStart=/usr/bin/env node ${remoteCurrent}/ops/backup-db.mjs\n`
    const backupTimerUnit = `[Unit]\nDescription=Daily midnight backup for ${options.appName}\n\n[Timer]\nOnCalendar=*-*-* 00:00:00\nPersistent=true\nUnit=${backupServiceName}.service\n\n[Install]\nWantedBy=timers.target\n`
    const healthCheck = [
      'if command -v curl >/dev/null 2>&1; then',
      '  healthy=0',
      '  for attempt in 1 2 3 4 5; do',
      `    if curl --fail --silent --show-error --max-time 5 ${shellQuote(`http://${options.appHost}:${options.appPort}/`)} >/dev/null; then healthy=1; break; fi`,
      '    sleep 2',
      '  done',
      '  if [ "$healthy" -ne 1 ]; then echo "Application health check failed; attempting rollback." >&2',
      rollback,
      '    exit 1',
      '  fi',
      'else echo "curl is not installed; application health check skipped." >&2; fi',
    ].join('\n')
    const remotePreparation = options.artifact ? [
      'set -euo pipefail',
      remoteCleanupOnExit,
      remoteMaintenance,
      "command -v npm >/dev/null 2>&1 || { echo 'npm is required on the server.' >&2; exit 1; }",
      "command -v node >/dev/null 2>&1 || { echo 'node is required on the server.' >&2; exit 1; }",
      `mkdir -p ${shellQuote(remoteRelease)}`,
      `if command -v unzip >/dev/null 2>&1; then unzip -q -o ${shellQuote(remoteArtifact)} -d ${shellQuote(remoteRelease)}; elif command -v python3 >/dev/null 2>&1; then python3 -m zipfile -e ${shellQuote(remoteArtifact)} ${shellQuote(remoteRelease)}; else echo 'unzip or python3 is required on the server.' >&2; exit 1; fi`,
      `test -f ${shellQuote(path.posix.join(remoteRelease, '.next/standalone/server.js'))}`,
      `test -f ${shellQuote(path.posix.join(remoteRelease, 'package.json'))}`,
      `cd ${shellQuote(remoteRelease)}`,
      'npm ci --omit=dev',
      `ln -sfn ${shellQuote(remoteEnv)} ${shellQuote(path.posix.join(remoteRelease, '.env.production'))}`,
      'NODE_ENV=production npm run db:migrate',
      `rm -f ${shellQuote(remoteArtifact)}`,
    ] : [
      'set -euo pipefail',
      remoteCleanupOnExit,
      remoteMaintenance,
      `cd ${shellQuote(remoteRelease)}`,
      "command -v npm >/dev/null 2>&1 || { echo 'npm is required on the server.' >&2; exit 1; }",
      "command -v node >/dev/null 2>&1 || { echo 'node is required on the server.' >&2; exit 1; }",
      'npm ci',
      `ln -sfn ${shellQuote(remoteEnv)} ${shellQuote(path.posix.join(remoteRelease, '.env.production'))}`,
      'NODE_ENV=production npm run db:migrate',
      'npm run build',
      `test -f ${shellQuote(path.posix.join(remoteRelease, '.next/standalone/server.js'))}`,
      'if [ -d public ]; then rm -rf .next/standalone/public && cp -R public .next/standalone/public; fi',
      'if [ -d .next/static ]; then rm -rf .next/standalone/.next/static && cp -R .next/static .next/standalone/.next/static; fi',
    ]
    const remoteBuild = [
      ...remotePreparation,
      previousCurrent,
      options.reloadNginx ? 'nginx -t' : 'true',
      `ln -sfn ${shellQuote(remoteRelease)} ${shellQuote(remoteCurrent)}`,
      `cat > ${shellQuote(remoteService)} <<'EOF'\n${serviceUnit}EOF`,
      `cat > ${shellQuote(remoteBackupService)} <<'EOF'\n${backupServiceUnit}EOF`,
      `cat > ${shellQuote(remoteBackupTimer)} <<'EOF'\n${backupTimerUnit}EOF`,
      'systemctl daemon-reload',
      `systemctl enable ${shellQuote(options.appName)}`,
      `systemctl enable --now ${shellQuote(`${backupServiceName}.timer`)}`,
      `if ! systemctl restart ${shellQuote(options.appName)}; then echo "Application restart failed; attempting rollback." >&2`,
      rollback,
      '  exit 1',
      'fi',
      healthCheck,
      options.reloadNginx ? 'nginx -s reload' : 'true',
      `systemctl status ${shellQuote(options.appName)} --no-pager`,
    ].join('\n')
    console.log(options.artifact
      ? '[5/6] Installing prebuilt artifact, installing runtime dependencies, migrating database, and restarting service'
      : '[5/6] Installing dependencies, building app, migrating database, and restarting service')
    await runCommand('ssh', [...sshArgs, sshTarget, remoteBuild])
    console.log(`[6/6] Deployment complete: ${options.siteUrl}`)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(`\nDeployment failed: ${error.message}`)
  process.exitCode = 1
})
