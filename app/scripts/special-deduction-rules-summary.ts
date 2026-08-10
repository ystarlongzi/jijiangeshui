import fs from 'node:fs/promises'
import path from 'node:path'

import { getPayload } from 'payload'

import { currentYear } from '../src/lib/site'
import { summarizeSpecialDeductionRules, type SpecialDeductionRuleDoc } from '../src/lib/special-deduction-rule-quality'

const useJson = process.argv.includes('--json')
const strict = process.argv.includes('--strict')

function getRuleYear() {
  const inlineArg = process.argv.find((arg) => arg.startsWith('--rule-year='))
  const separateIndex = process.argv.indexOf('--rule-year')
  const rawValue = inlineArg?.slice('--rule-year='.length) || (separateIndex >= 0 ? process.argv[separateIndex + 1] : undefined)
  const year = rawValue ? Number(rawValue) : currentYear
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error(`规则年度必须是 2000-2100 的整数，当前值：${rawValue}`)
  return year
}

async function loadLocalEnv() {
  for (const fileName of ['.env', '.env.local']) {
    const envPath = path.resolve(process.cwd(), fileName)
    try {
      const content = await fs.readFile(envPath, 'utf8')
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
        const key = trimmed.slice(0, trimmed.indexOf('=')).trim()
        const rawValue = trimmed.slice(trimmed.indexOf('=') + 1).trim()
        if (key && process.env[key] === undefined) process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2')
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
}

async function main() {
  await loadLocalEnv()
  if (!process.env.DATABASE_URI) throw new Error('缺少 DATABASE_URI，无法读取专项附加扣除 CMS。')

  const ruleYear = getRuleYear()
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config })
  try {
    const result = await payload.find({
      collection: 'special-deduction-rules',
      depth: 0,
      limit: 2000,
      where: { ruleYear: { equals: ruleYear } },
    })
    const summary = summarizeSpecialDeductionRules(result.docs as SpecialDeductionRuleDoc[], ruleYear)
    if (useJson) console.log(JSON.stringify(summary, null, 2))
    else {
      console.log(`专项附加扣除 CMS 规则概览（${ruleYear}）`)
      console.log(`必需规则：${summary.activeRequired}/${summary.required} 条 active`)
      console.log(`状态：active ${summary.status.active}，待审核 ${summary.status.pendingReview}，已归档 ${summary.status.archived}`)
      console.log(`来源完整：${summary.active - summary.sourceGaps.length}/${summary.active}，结构问题：${summary.shapeGaps.length}，解析警告：${summary.warningCount}`)
      if (summary.missing.length) console.log(`缺少 active：${summary.missing.join('、')}`)
      if (summary.duplicates.length) console.log(`重复 active：${summary.duplicates.join('、')}`)
      if (summary.sourceGaps.length) console.log(`来源不完整：${summary.sourceGaps.join('、')}`)
      if (summary.shapeGaps.length) console.log(`结构不完整：${summary.shapeGaps.join('、')}`)
      console.log(summary.ready ? '验收结果：可进入前台读取。' : '验收结果：暂不可进入前台读取，请先完成审核。')
    }
    if (strict && !summary.ready) process.exitCode = 1
  } finally {
    await payload.destroy()
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode || 0), 0)
  })
