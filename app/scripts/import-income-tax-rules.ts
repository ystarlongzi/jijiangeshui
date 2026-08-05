import fs from 'node:fs/promises'
import path from 'node:path'

import { specialDeductionGroups } from '../src/lib/special-deductions'
import { currentYear, ruleCheckedDate } from '../src/lib/site'
import { taxBrackets } from '../src/lib/tax-rules'

const dryRun = process.argv.includes('--dry-run')

const rateRanges = [
  '不超过 36,000 元',
  '超过 36,000 元至 144,000 元',
  '超过 144,000 元至 300,000 元',
  '超过 300,000 元至 420,000 元',
  '超过 420,000 元至 660,000 元',
  '超过 660,000 元至 960,000 元',
  '超过 960,000 元',
]

const source = {
  title: '国家税务总局法规库与 12366 公开规则',
  url: 'https://12366.chinatax.gov.cn/bzds/pdfview/pdf/068-3-1.pdf',
  checkedAt: ruleCheckedDate,
  remark: '该种子数据用于本地 CMS 初始化，发布前仍应由规则管理员复核来源。',
}

async function loadLocalEnv() {
  // 独立 tsx 脚本不会自动读取 .env，所以在动态加载 Payload 配置前补充环境变量。
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
  if (!process.env.DATABASE_URI) throw new Error('缺少 DATABASE_URI，无法导入 CMS 规则。')

  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('../src/payload.config'),
  ])
  const payload = await getPayload({ config })

  try {
    const taxRateData = {
      ruleTitle: `${currentYear} 年居民工资薪金累计预扣率表`,
      ruleYear: currentYear,
      incomeCategory: 'comprehensive' as const,
      incomeType: 'salary' as const,
      taxpayerIdentity: 'resident' as const,
      rateMode: 'table' as const,
      tableRows: taxBrackets.map((bracket, index) => ({
        rangeLabel: bracket.rangeLabel || rateRanges[index],
        lowerBound: index === 0 ? 0 : taxBrackets[index - 1].ceiling,
        upperBound: Number.isFinite(bracket.ceiling) ? bracket.ceiling : undefined,
        rate: bracket.rate,
        quickDeduction: bracket.quick,
        sortOrder: index + 1,
      })),
      effectiveFrom: `${currentYear}-01-01`,
      ruleStatus: 'active' as const,
      source,
      note: '居民个人工资薪金采用累计预扣法，按累计收入、累计扣除和已预扣税额计算本月税额。',
      warnings: [],
      rawData: { source: 'built-in-verified-seed', year: currentYear },
    }

    await upsert(
      payload,
      'tax-rate-rules',
      { ruleYear: currentYear, incomeType: 'salary', taxpayerIdentity: 'resident' },
      taxRateData,
      `${currentYear} 年工资薪金税率规则`,
    )

    const deductionSource = {
      ...source,
      url: 'https://fgk.chinatax.gov.cn/zcfgk/c102440/c5213594/content.html',
    }
    const deductionTypeByGroupKey: Record<string, string> = {
      children: 'childEducation',
      infant: 'infantCare',
      education: 'continuingEducation',
      loan: 'housingLoanInterest',
      rent: 'housingRent',
      elderly: 'elderlyCare',
    }

    for (const group of specialDeductionGroups) {
      const deductionType = deductionTypeByGroupKey[group.key]
      if (!deductionType) continue
      const deductionData = {
        ruleTitle: `${currentYear} 年${group.title}规则`,
        ruleYear: currentYear,
        deductionType,
        monthlyAmount: group.options[0]?.amount || 0,
        maxMonthlyAmount: Math.max(0, ...group.options.map((option) => option.amount)),
        annualAmount: (group.options[0]?.amount || 0) * 12,
        amountUnit: 'monthly' as const,
        allocationOptions: group.options.map((option, index) => ({
          label: option.label,
          monthlyAmount: option.amount,
          description: group.note,
          sortOrder: index + 1,
        })),
        conditions: {
          summary: group.note,
          requiresProof: true,
          canShareWithSpouse: group.key === 'children' || group.key === 'infant' || group.key === 'loan',
          exclusiveWith: group.key === 'loan' ? '同一纳税年度通常不能与住房租金同时享受。' : group.key === 'rent' ? '同一纳税年度通常不能与住房贷款利息同时享受。' : '',
        },
        effectiveFrom: `${currentYear}-01-01`,
        ruleStatus: 'active' as const,
        source: deductionSource,
        warnings: [],
        rawData: { source: 'built-in-verified-seed', year: currentYear, group: group.key },
      }

      await upsert(
        payload,
        'special-deduction-rules',
        { ruleYear: currentYear, deductionType },
        deductionData,
        `${currentYear} 年${group.title}规则`,
      )
    }
  } finally {
    await payload.destroy()
  }
}

async function upsert(payload: Awaited<ReturnType<typeof import('payload').getPayload>>, collection: 'tax-rate-rules' | 'special-deduction-rules', identity: Record<string, string | number>, data: Record<string, unknown>, title: string) {
  if (dryRun) {
    console.log(`[dry-run] ${title}`)
    return
  }

  const existing = await payload.find({
    collection,
    limit: 1,
    where: { and: Object.entries(identity).map(([key, value]) => ({ [key]: { equals: value } })) },
  })

  if (existing.docs[0]) {
    await payload.update({ collection, id: existing.docs[0].id, data: data as never })
    console.log(`已更新：${title}`)
  } else {
    await payload.create({ collection, data: data as never, draft: false })
    console.log(`已创建：${title}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
