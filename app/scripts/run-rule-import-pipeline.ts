import { spawn } from 'node:child_process'
import path from 'node:path'

const args = process.argv.slice(2)
const wantsHelp = args.includes('--help') || args.includes('-h')
const inputPath = args.find((arg) => !arg.startsWith('--'))
const writeToCms = process.argv.includes('--write')
const publishToFrontend = process.argv.includes('--publish')
const clearWarnings = process.argv.includes('--clear-warnings')
const showCmsSummary = writeToCms && !process.argv.includes('--no-summary')
const policyYearArgIndex = process.argv.indexOf('--policy-year')
const policyYearArgs = policyYearArgIndex >= 0 ? ['--policy-year', process.argv[policyYearArgIndex + 1]].filter(Boolean) : []

function printHelp() {
  console.log(`
社保公积金规则导入流水线

用法：
  npm run rules:pipeline -- <采集 JSON 文件> [选项]

默认流程：
  validate -> audit -> import --dry-run

选项：
  --write            写入 Payload CMS 草稿
  --publish          写入后发布为前台有效规则，需要同时使用 --write
  --clear-warnings   发布时清理第三方来源 warning
  --policy-year 年份  限定发布和概览的政策年份，例如 2026
  --no-summary       写入或发布后不输出 CMS 概览
  -h, --help         查看帮助

示例：
  npm run rules:pipeline -- ./data/hrwork-social-insurance-2026.json
  npm run rules:pipeline -- ./data/hrwork-social-insurance-2026.json --write
  npm run rules:pipeline -- ./data/hrwork-social-insurance-2026.json --write --publish --clear-warnings --policy-year 2026
`.trim())
}

if (wantsHelp) {
  printHelp()
  process.exit(0)
}

if (!inputPath) {
  printHelp()
  throw new Error('\n请提供采集 JSON 文件。')
}

if (publishToFrontend && !writeToCms) {
  throw new Error('--publish 会修改 Payload CMS，需要同时追加 --write。')
}

const requiredInputPath = inputPath

function runStep(label: string, commandArgs: string[]) {
  return new Promise<void>((resolve, reject) => {
    console.log(`\n==> ${label}`)
    const child = spawn(process.execPath, ['--import', 'tsx', ...commandArgs], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${label} 失败，退出码：${code}`))
    })
  })
}

async function main() {
  const normalizedInput = path.resolve(process.cwd(), requiredInputPath)
  await runStep('校验采集 JSON', ['scripts/validate-rule-import.ts', normalizedInput])
  await runStep('审计规则质量', ['scripts/audit-rules.ts', normalizedInput])
  await runStep('预演 Payload 导入', ['scripts/import-rules.ts', normalizedInput, '--dry-run'])

  if (!writeToCms) {
    console.log('\n已完成校验、审计和 dry-run。确认无误后追加 --write 写入 Payload CMS。')
    return
  }

  await runStep('写入 Payload CMS 草稿', ['scripts/import-rules.ts', normalizedInput])

  if (!publishToFrontend) {
    if (showCmsSummary) {
      await runStep('汇总 Payload 规则概览', ['scripts/cms-rules-summary.ts', ...policyYearArgs])
    }

    console.log('\n已写入 Payload CMS 草稿。确认数据可用后追加 --publish 发布为前台有效规则。')
    return
  }

  await runStep('发布前台有效规则', [
    'scripts/publish-social-insurance-policies.ts',
    '--write',
    ...(clearWarnings ? ['--clear-warnings'] : []),
    ...policyYearArgs,
  ])

  if (showCmsSummary) {
    await runStep('汇总 Payload 规则概览', ['scripts/cms-rules-summary.ts', ...policyYearArgs])
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
