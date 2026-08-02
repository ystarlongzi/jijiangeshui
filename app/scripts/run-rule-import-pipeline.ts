import { spawn } from 'node:child_process'
import path from 'node:path'

const inputPath = process.argv[2]
const writeToCms = process.argv.includes('--write')
const publishToFrontend = process.argv.includes('--publish')
const clearWarnings = process.argv.includes('--clear-warnings')
const policyYearArgIndex = process.argv.indexOf('--policy-year')
const policyYearArgs = policyYearArgIndex >= 0 ? ['--policy-year', process.argv[policyYearArgIndex + 1]].filter(Boolean) : []

if (!inputPath) {
  throw new Error('请提供采集 JSON 文件，例如：npm run rules:pipeline -- ./data/hrwork.json --write')
}

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
  const normalizedInput = path.resolve(process.cwd(), inputPath)
  await runStep('校验采集 JSON', ['scripts/validate-rule-import.ts', normalizedInput])
  await runStep('审计规则质量', ['scripts/audit-rules.ts', normalizedInput])
  await runStep('预演 Payload 导入', ['scripts/import-rules.ts', normalizedInput, '--dry-run'])

  if (!writeToCms) {
    console.log('\n已完成校验、审计和 dry-run。确认无误后追加 --write 写入 Payload CMS。')
    return
  }

  await runStep('写入 Payload CMS 草稿', ['scripts/import-rules.ts', normalizedInput])

  if (!publishToFrontend) {
    console.log('\n已写入 Payload CMS 草稿。确认数据可用后追加 --publish 发布为前台有效规则。')
    return
  }

  await runStep('发布前台有效规则', [
    'scripts/publish-social-insurance-policies.ts',
    '--write',
    ...(clearWarnings ? ['--clear-warnings'] : []),
    ...policyYearArgs,
  ])
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
