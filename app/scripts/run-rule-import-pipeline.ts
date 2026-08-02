import { spawn } from 'node:child_process'
import path from 'node:path'

/**
 * 一键串起城市社保公积金规则的导入流程。
 *
 * 设计意图：
 * - 默认只跑校验、审计和导入 dry-run，让采集文件先过一遍安全检查。
 * - 只有显式传入 --write 时才连接 Payload CMS 写入草稿。
 * - 只有同时传入 --write --publish 时才发布为前台可读的 active 规则。
 *
 * 这样手动导入 JSON 时不需要记 4 条命令，同时也避免误把第三方采集数据直接发布。
 */
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
    // 用当前 Node 进程 + tsx 执行 TypeScript 脚本，继承 stdio 让每个子步骤自己输出进度和错误。
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

  // 第一段永远只读输入文件：先确认 JSON 结构、业务质量和 Payload 映射都能跑通。
  await runStep('校验采集 JSON', ['scripts/validate-rule-import.ts', normalizedInput])
  await runStep('审计规则质量', ['scripts/audit-rules.ts', normalizedInput])
  await runStep('预演 Payload 导入', ['scripts/import-rules.ts', normalizedInput, '--dry-run'])

  if (!writeToCms) {
    console.log('\n已完成校验、审计和 dry-run。确认无误后追加 --write 写入 Payload CMS。')
    return
  }

  // 第二段才会写 CMS。导入脚本会创建/更新城市和政策草稿，默认不会影响前台。
  await runStep('写入 Payload CMS 草稿', ['scripts/import-rules.ts', normalizedInput])

  if (!publishToFrontend) {
    if (showCmsSummary) {
      await runStep('汇总 Payload 规则概览', ['scripts/cms-rules-summary.ts', ...policyYearArgs])
    }

    console.log('\n已写入 Payload CMS 草稿。确认数据可用后追加 --publish 发布为前台有效规则。')
    return
  }

  // 第三段发布 active 规则。这个动作会影响前台城市规则读取，所以要求调用方显式传 --publish。
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
