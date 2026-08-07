import fs from 'node:fs/promises'
import path from 'node:path'

import { getPayload } from 'payload'

import { currentYear } from '../src/lib/site'

type TaxpayerIdentity = 'resident' | 'nonResident' | 'notApplicable'
type IncomeType = 'salary' | 'labor' | 'author' | 'license' | 'business' | 'rental' | 'transfer' | 'dividend' | 'accidental'

type TaxRateDoc = {
  id: string | number
  ruleYear?: number | null
  incomeType?: IncomeType | null
  taxpayerIdentity?: TaxpayerIdentity | null
  rateMode?: 'table' | 'flat' | null
  flatRate?: number | null
  tableRows?: Array<unknown> | null
  ruleStatus?: 'pendingReview' | 'active' | 'archived' | null
  source?: { url?: string | null; checkedAt?: string | null } | null
  warnings?: Array<{ message?: string | null }> | null
}

const requiredRules: Array<{ incomeType: IncomeType; taxpayerIdentity: TaxpayerIdentity; label: string }> = [
  { incomeType: 'salary', taxpayerIdentity: 'resident', label: '居民工资薪金' },
  { incomeType: 'salary', taxpayerIdentity: 'nonResident', label: '非居民工资薪金' },
  { incomeType: 'labor', taxpayerIdentity: 'resident', label: '居民劳务报酬' },
  { incomeType: 'labor', taxpayerIdentity: 'nonResident', label: '非居民劳务报酬' },
  { incomeType: 'author', taxpayerIdentity: 'resident', label: '居民稿酬' },
  { incomeType: 'author', taxpayerIdentity: 'nonResident', label: '非居民稿酬' },
  { incomeType: 'license', taxpayerIdentity: 'resident', label: '居民特许权使用费' },
  { incomeType: 'license', taxpayerIdentity: 'nonResident', label: '非居民特许权使用费' },
  { incomeType: 'business', taxpayerIdentity: 'notApplicable', label: '经营所得' },
  { incomeType: 'rental', taxpayerIdentity: 'notApplicable', label: '财产租赁所得' },
  { incomeType: 'transfer', taxpayerIdentity: 'notApplicable', label: '财产转让所得' },
  { incomeType: 'dividend', taxpayerIdentity: 'notApplicable', label: '利息股息红利所得' },
  { incomeType: 'accidental', taxpayerIdentity: 'notApplicable', label: '偶然所得' },
]

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

function getRuleKey(incomeType: IncomeType, taxpayerIdentity: TaxpayerIdentity) {
  return `${incomeType}:${taxpayerIdentity}`
}

async function main() {
  await loadLocalEnv()
  if (!process.env.DATABASE_URI) throw new Error('缺少 DATABASE_URI，无法读取税率 CMS。')

  const ruleYear = getRuleYear()
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config })

  try {
    const result = await payload.find({
      collection: 'tax-rate-rules',
      depth: 0,
      limit: 2000,
      where: { ruleYear: { equals: ruleYear } },
    })
    const docs = result.docs as TaxRateDoc[]
    const activeDocs = docs.filter((doc) => doc.ruleStatus === 'active')
    const activeByKey = new Map<string, TaxRateDoc[]>()
    for (const doc of activeDocs) {
      if (!doc.incomeType || !doc.taxpayerIdentity) continue
      const key = getRuleKey(doc.incomeType, doc.taxpayerIdentity)
      activeByKey.set(key, [...(activeByKey.get(key) || []), doc])
    }

    const missing = requiredRules.filter((rule) => !activeByKey.has(getRuleKey(rule.incomeType, rule.taxpayerIdentity))).map((rule) => rule.label)
    const duplicates = [...activeByKey.entries()].filter(([, rules]) => rules.length > 1).map(([key, rules]) => `${key}（${rules.length} 条）`)
    const activeRequired = requiredRules.length - missing.length
    const sourceGaps = activeDocs
      .filter((doc) => !doc.source?.url || !doc.source?.checkedAt)
      .map((doc) => `${doc.incomeType || '未知'}:${doc.taxpayerIdentity || '未知'}`)
    const shapeGaps = activeDocs
      .filter((doc) => (doc.rateMode === 'table' && !doc.tableRows?.length) || (doc.rateMode === 'flat' && typeof doc.flatRate !== 'number'))
      .map((doc) => `${doc.incomeType || '未知'}:${doc.taxpayerIdentity || '未知'}`)
    const warningCount = activeDocs.reduce((total, doc) => total + (doc.warnings?.length || 0), 0)
    const status = docs.reduce((summary, doc) => {
      const key = doc.ruleStatus || 'pendingReview'
      summary[key] += 1
      return summary
    }, { pendingReview: 0, active: 0, archived: 0 })
    const summary = {
      ruleYear,
      required: requiredRules.length,
      activeRequired,
      active: activeDocs.length,
      status,
      missing,
      duplicates,
      sourceGaps,
      shapeGaps,
      warningCount,
      ready: missing.length === 0 && duplicates.length === 0 && sourceGaps.length === 0 && shapeGaps.length === 0 && warningCount === 0,
    }

    if (useJson) {
      console.log(JSON.stringify(summary, null, 2))
    } else {
      console.log(`个人所得税 CMS 规则概览（${ruleYear}）`)
      console.log(`必需规则：${activeRequired}/${requiredRules.length} 条 active`)
      console.log(`状态：active ${status.active}，待审核 ${status.pendingReview}，已归档 ${status.archived}`)
      console.log(`来源完整：${activeDocs.length - sourceGaps.length}/${activeDocs.length}，解析警告：${warningCount}`)
      if (missing.length) console.log(`缺少 active：${missing.join('、')}`)
      if (duplicates.length) console.log(`重复 active：${duplicates.join('、')}`)
      if (sourceGaps.length) console.log(`来源不完整：${sourceGaps.join('、')}`)
      if (shapeGaps.length) console.log(`结构不完整：${shapeGaps.join('、')}`)
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
    // Payload 连接池可能保留事件循环，显式结束脚本才能让发布流水线可靠返回。
    setTimeout(() => process.exit(process.exitCode || 0), 0)
  })
