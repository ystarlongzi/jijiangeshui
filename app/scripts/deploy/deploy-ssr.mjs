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
  --skip-build              Upload source, env and Nginx config only
  --reload-nginx            Run nginx -t and reload Nginx after activation
  --no-prompt               Do not ask for deployment parameters
  --help                    Show this help
`)
}

function parseArgs(argv) {
  const options = { ...defaults, envFile: path.join(appRoot, '.env.production'), skipBuild: false, reloadNginx: false, noPrompt: false }
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
  let replaced = false
  const lines = content.split(/\r?\n/u).map((line) => {
    if (!/^\s*NEXT_PUBLIC_SERVER_URL\s*=/u.test(line)) return line
    replaced = true
    return `NEXT_PUBLIC_SERVER_URL=${siteUrl}`
  })
  if (!replaced) lines.push(`NEXT_PUBLIC_SERVER_URL=${siteUrl}`)
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
  await ensureFileExists(options.key, 'SSH private key')
  await ensureFileExists(path.join(appRoot, 'package.json'), 'package.json')
  await ensureFileExists(options.envFile, 'Env file')
  const envContent = await readFile(options.envFile, 'utf8')
  const envValues = readEnvValues(envContent)
  for (const key of ['DATABASE_URI', 'PAYLOAD_SECRET']) if (!envValues[key]) throw new Error(`${key} must be set in the env file.`)

  const sshTarget = `${options.user}@${options.host}`
  const sshArgs = ['-i', options.key, '-p', options.sshPort, '-o', 'StrictHostKeyChecking=accept-new']
  const releaseId = new Date().toISOString().replace(/\D/gu, '').slice(0, 17)
  const remoteRelease = path.posix.join(options.deployPath, 'releases', releaseId)
  const remoteCurrent = path.posix.join(options.deployPath, 'current')
  const remoteEnv = path.posix.join(options.deployPath, 'shared', '.env.production')
  const remoteNginx = path.posix.join(options.nginxPath, 'jijiangeshui.conf')
  const remoteService = `/etc/systemd/system/${options.appName}.service`
  const tempFiles = await prepareTempFiles(options, envContent)

  try {
    console.log(`[1/6] Preparing remote directories on ${sshTarget}`)
    await runCommand('ssh', [...sshArgs, sshTarget, [
      'set -euo pipefail',
      `mkdir -p ${shellQuote(remoteRelease)} ${shellQuote(path.posix.join(options.deployPath, 'releases'))} ${shellQuote(path.posix.join(options.deployPath, 'shared'))} ${shellQuote(options.nginxPath)}`,
    ].join('\n')])

    console.log(`[2/6] Uploading app source to ${remoteRelease}`)
    const rsyncSsh = `ssh -i ${shellQuote(options.key)} -p ${shellQuote(options.sshPort)} -o StrictHostKeyChecking=accept-new`
    await runCommand('rsync', ['-az', '--delete', '--exclude', '.git', '--exclude', '.next', '--exclude', 'node_modules', '--exclude', '.deploy-tmp', '--exclude', '.env', '--exclude', '.env.*', '--exclude', '.DS_Store', '--exclude', 'tsconfig.tsbuildinfo', '-e', rsyncSsh, `${appRoot}/`, `${sshTarget}:${remoteRelease}/`])

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
    const remoteBuild = [
      'set -euo pipefail',
      `cd ${shellQuote(remoteRelease)}`,
      "command -v npm >/dev/null 2>&1 || { echo 'npm is required on the server.' >&2; exit 1; }",
      "command -v node >/dev/null 2>&1 || { echo 'node is required on the server.' >&2; exit 1; }",
      'npm ci',
      `ln -sfn ${shellQuote(remoteEnv)} ${shellQuote(path.posix.join(remoteRelease, '.env.production'))}`,
      'npm run build',
      `test -f ${shellQuote(path.posix.join(remoteRelease, '.next/standalone/server.js'))}`,
      'if [ -d public ]; then rm -rf .next/standalone/public && cp -R public .next/standalone/public; fi',
      'if [ -d .next/static ]; then rm -rf .next/standalone/.next/static && cp -R .next/static .next/standalone/.next/static; fi',
      previousCurrent,
      options.reloadNginx ? 'nginx -t' : 'true',
      `ln -sfn ${shellQuote(remoteRelease)} ${shellQuote(remoteCurrent)}`,
      `cat > ${shellQuote(remoteService)} <<'EOF'\n${serviceUnit}EOF`,
      'systemctl daemon-reload',
      `systemctl enable ${shellQuote(options.appName)}`,
      `if ! systemctl restart ${shellQuote(options.appName)}; then echo "Application restart failed; attempting rollback." >&2`,
      rollback,
      '  exit 1',
      'fi',
      healthCheck,
      options.reloadNginx ? 'nginx -s reload' : 'true',
      `systemctl status ${shellQuote(options.appName)} --no-pager`,
    ].join('\n')
    console.log('[5/6] Installing dependencies, building app, and restarting service')
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
