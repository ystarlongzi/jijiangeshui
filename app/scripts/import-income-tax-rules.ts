import fs from 'node:fs/promises'
import path from 'node:path'

import { specialDeductionGroups } from '../src/lib/special-deductions'
import { businessTaxBrackets } from '../src/lib/business-tax'
import { laborTaxBrackets } from '../src/lib/labor-tax'
import { currentYear, ruleCheckedDate } from '../src/lib/site'
import { taxBrackets } from '../src/lib/tax-rules'

const dryRun = process.argv.includes('--dry-run')
const publish = process.argv.includes('--publish')

const rateRanges = [
  '不超过 36,000 元',
  '超过 36,000 元至 144,000 元',
  '超过 144,000 元至 300,000 元',
  '超过 300,000 元至 420,000 元',
  '超过 420,000 元至 660,000 元',
  '超过 660,000 元至 960,000 元',
  '超过 960,000 元',
]

const nonResidentBrackets = [
  { ceiling: 3000, rate: 0.03, quick: 0 },
  { ceiling: 12000, rate: 0.1, quick: 210 },
  { ceiling: 25000, rate: 0.2, quick: 1410 },
  { ceiling: 35000, rate: 0.25, quick: 2660 },
  { ceiling: 55000, rate: 0.3, quick: 4410 },
  { ceiling: 80000, rate: 0.35, quick: 7160 },
  { ceiling: Infinity, rate: 0.45, quick: 15160 },
]

const nonResidentRanges = [
  '不超过 3,000 元', '超过 3,000 元至 12,000 元', '超过 12,000 元至 25,000 元', '超过 25,000 元至 35,000 元',
  '超过 35,000 元至 55,000 元', '超过 55,000 元至 80,000 元', '超过 80,000 元',
]

const laborRanges = ['不超过 20,000 元', '超过 20,000 元至 50,000 元', '超过 50,000 元']
const businessRanges = ['不超过 30,000 元', '超过 30,000 元至 90,000 元', '超过 90,000 元至 300,000 元', '超过 300,000 元至 500,000 元', '超过 500,000 元']

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
  if (!dryRun && !process.env.DATABASE_URI) throw new Error('缺少 DATABASE_URI，无法导入 CMS 规则。')

  // dry-run 只生成并检查导入清单，不初始化 Payload，方便在没有数据库的环境先做发布前预演。
  const payload = dryRun
    ? null
    : await (async () => {
        const [{ getPayload }, { default: config }] = await Promise.all([
          import('payload'),
          import('../src/payload.config'),
        ])
        return getPayload({ config })
      })()
  const importStatus: 'active' | 'pendingReview' = publish ? 'active' : 'pendingReview'

  try {
    const tableSeed = (brackets: Array<{ ceiling: number; rate: number; quick: number }>, ranges: string[]) => brackets.map((bracket, index) => ({
      rangeLabel: ranges[index] || '按规则区间',
      lowerBound: index === 0 ? 0 : brackets[index - 1].ceiling,
      upperBound: Number.isFinite(bracket.ceiling) ? bracket.ceiling : undefined,
      rate: bracket.rate,
      quickDeduction: bracket.quick,
      sortOrder: index + 1,
    }))

    const tableRule = (ruleTitle: string, incomeType: string, taxpayerIdentity: string, brackets: Array<{ ceiling: number; rate: number; quick: number }>, ranges: string[], note: string, incomeCategory: 'comprehensive' | 'classified' = 'comprehensive') => ({
      ruleTitle,
      ruleYear: currentYear,
      incomeCategory,
      incomeType,
      taxpayerIdentity,
      rateMode: 'table',
      tableRows: tableSeed(brackets, ranges),
      note,
    })

    const flatRule = (ruleTitle: string, incomeType: string, taxpayerIdentity: string, note: string, incomeCategory: 'comprehensive' | 'classified' = 'classified') => ({
      ruleTitle,
      ruleYear: currentYear,
      incomeCategory,
      incomeType,
      taxpayerIdentity,
      rateMode: 'flat',
      flatRate: 0.2,
      note,
    })

    const taxRateSeeds = [
      tableRule(`${currentYear} 年居民工资薪金累计预扣率表`, 'salary', 'resident', taxBrackets, rateRanges, '居民个人工资薪金采用累计预扣法，按累计收入、累计扣除和已预扣税额计算本月税额。'),
      tableRule(`${currentYear} 年非居民工资薪金税率表`, 'salary', 'nonResident', nonResidentBrackets, nonResidentRanges, '非居民个人工资薪金按月计算，不使用居民个人工资薪金的累计预扣法。'),
      tableRule(`${currentYear} 年居民劳务报酬预扣率表`, 'labor', 'resident', laborTaxBrackets, laborRanges, '居民个人劳务报酬通常按次或按月预扣，年度汇算时并入综合所得。'),
      tableRule(`${currentYear} 年非居民劳务报酬税率表`, 'labor', 'nonResident', nonResidentBrackets, nonResidentRanges, '非居民个人劳务报酬通常按次或按月代扣代缴。'),
      flatRule(`${currentYear} 年居民稿酬预扣率规则`, 'author', 'resident', '稿酬所得收入额按规定减按 70% 计算，通常适用 20% 比例预扣率。', 'comprehensive'),
      flatRule(`${currentYear} 年非居民稿酬税率规则`, 'author', 'nonResident', '非居民个人稿酬所得按规定计算，当前种子规则使用 20% 比例税率。', 'comprehensive'),
      flatRule(`${currentYear} 年居民特许权使用费预扣率规则`, 'license', 'resident', '特许权使用费通常按次或按月预扣，适用 20% 比例预扣率。', 'comprehensive'),
      flatRule(`${currentYear} 年非居民特许权使用费税率规则`, 'license', 'nonResident', '非居民个人特许权使用费按规定计算，当前种子规则使用 20% 比例税率。', 'comprehensive'),
      tableRule(`${currentYear} 年经营所得税率表`, 'business', 'notApplicable', businessTaxBrackets, businessRanges, '经营所得按年度收入总额减除成本、费用和损失后的余额计算。', 'classified'),
      flatRule(`${currentYear} 年财产租赁所得税率规则`, 'rental', 'notApplicable', '财产租赁所得通常按次或按月计算，适用 20% 比例税率。'),
      flatRule(`${currentYear} 年财产转让所得税率规则`, 'transfer', 'notApplicable', '财产转让所得按收入额减除财产原值和合理费用后的余额计算，适用 20% 比例税率。'),
      flatRule(`${currentYear} 年利息股息红利所得税率规则`, 'dividend', 'notApplicable', '利息、股息、红利所得通常按次计算，适用 20% 比例税率。'),
      flatRule(`${currentYear} 年偶然所得税率规则`, 'accidental', 'notApplicable', '偶然所得以每次取得的收入为一次，适用 20% 比例税率。'),
    ]

    for (const seed of taxRateSeeds) {
      const data = {
        ...seed,
        effectiveFrom: `${currentYear}-01-01`,
        // 默认写入待审核草稿；只有明确传入 --publish 才会影响前台读取。
        ruleStatus: importStatus,
        source,
        warnings: [],
        rawData: { source: 'built-in-verified-seed', year: currentYear, incomeType: seed.incomeType },
      }
      await upsert(
        payload,
        'tax-rate-rules',
        { ruleYear: currentYear, incomeType: seed.incomeType, taxpayerIdentity: seed.taxpayerIdentity },
        data,
        seed.ruleTitle,
      )
    }

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
        ruleStatus: importStatus,
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
    await payload?.destroy()
  }
}

async function upsert(payload: Awaited<ReturnType<typeof import('payload').getPayload>> | null, collection: 'tax-rate-rules' | 'special-deduction-rules', identity: Record<string, string | number>, data: Record<string, unknown>, title: string) {
  if (dryRun) {
    console.log(`[dry-run] ${title}`)
    return
  }
  if (!payload) throw new Error('导入客户端未初始化。')

  const existing = await payload.find({
    collection,
    limit: 1,
    where: { and: Object.entries(identity).map(([key, value]) => ({ [key]: { equals: value } })) },
  })

  if (existing.docs[0]) {
    await payload.update({ collection, id: existing.docs[0].id, data: data as never, draft: !publish })
    console.log(`已更新：${title}`)
  } else {
    await payload.create({ collection, data: data as never, draft: !publish })
    console.log(`已创建：${title}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    // Payload 的数据库连接池可能仍保留事件循环，显式结束脚本才能让发布流水线正常返回结果。
    setTimeout(() => process.exit(process.exitCode || 0), 0)
  })
