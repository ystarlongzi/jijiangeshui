import fs from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

const sourceStatusSchema = z.enum(['verifiedPartial', 'needsParsing', 'needsOfficialSource', 'verifiedComplete'])

const sourceItemSchema = z.object({
  scope: z.string(),
  title: z.string(),
  url: z.string().url(),
  status: sourceStatusSchema,
  notes: z.string().optional(),
  facts: z
    .array(
      z.object({
        key: z.string(),
        value: z.union([z.string(), z.number()]),
        unit: z.string().optional(),
        evidence: z.string().optional(),
      }),
    )
    .optional(),
})

const sourceCatalogSchema = z.object({
  updatedAt: z.string(),
  cities: z.array(
    z.object({
      city: z.string(),
      cityName: z.string(),
      policyYear: z.number(),
      sources: z.array(sourceItemSchema),
    }),
  ),
})

type SourceStatus = z.infer<typeof sourceStatusSchema>

const positionalArgs = process.argv.slice(2).filter((argument) => !argument.startsWith('--'))
const inputPath = positionalArgs[0] || './data/city-rule-sources.json'
const checkNetwork = process.argv.includes('--network')
const jsonOutput = process.argv.includes('--json')
const showGaps = process.argv.includes('--gaps')

const requiredFactGroups = [
  {
    scope: 'pension',
    label: '养老保险',
    keys: ['pensionBaseMin', 'pensionBaseMax', 'pensionEmployeeRate', 'pensionEmployerRate'],
  },
  {
    scope: 'medical',
    label: '医疗保险',
    keys: ['medicalBaseMin', 'medicalBaseMax', 'medicalEmployeeRate', 'medicalEmployerRate'],
  },
  {
    scope: 'unemployment',
    label: '失业保险',
    keys: ['unemploymentBaseMin', 'unemploymentBaseMax', 'unemploymentEmployeeRate', 'unemploymentEmployerRate'],
  },
  {
    scope: 'injury',
    label: '工伤保险',
    keys: ['injuryBaseMin', 'injuryBaseMax', 'injuryEmployerRate'],
  },
  {
    scope: 'maternity',
    label: '生育保险',
    keys: ['maternityBaseMin', 'maternityBaseMax', 'maternityEmployerRate'],
  },
  {
    scope: 'housingFund',
    label: '住房公积金',
    keys: ['housingBaseMin', 'housingBaseMax', 'housingRateMin', 'housingRateMax'],
  },
]

function getFactKeys(city: z.infer<typeof sourceCatalogSchema>['cities'][number]) {
  return new Set(city.sources.flatMap((source) => source.facts?.map((fact) => fact.key) || []))
}

function createGapRows(catalog: z.infer<typeof sourceCatalogSchema>) {
  return catalog.cities.map((city) => {
    const factKeys = getFactKeys(city)
    const missingGroups = requiredFactGroups
      .map((group) => {
        const missingKeys = group.keys.filter((key) => !factKeys.has(key))
        return missingKeys.length > 0
          ? `${group.label}缺${missingKeys.length}/${group.keys.length}`
          : ''
      })
      .filter(Boolean)

    return {
      city: city.cityName,
      year: city.policyYear,
      facts: factKeys.size,
      completeGroups: requiredFactGroups.length - missingGroups.length,
      missingGroups: missingGroups.length > 0 ? missingGroups.join('；') : '无',
    }
  })
}

function createStatusSummary() {
  return {
    verifiedComplete: 0,
    verifiedPartial: 0,
    needsParsing: 0,
    needsOfficialSource: 0,
  } satisfies Record<SourceStatus, number>
}

async function checkUrl(url: string) {
  if (!checkNetwork) return 'skipped'

  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    if (response.ok) return String(response.status)

    // 有些政务站点不支持 HEAD，请求失败时再用 GET 轻量兜底。
    const fallback = await fetch(url, { method: 'GET', redirect: 'follow' })
    return String(fallback.status)
  } catch (error) {
    return error instanceof Error ? error.message : 'unknown error'
  }
}

async function main() {
  const absolutePath = path.resolve(process.cwd(), inputPath)
  const catalog = sourceCatalogSchema.parse(JSON.parse(await fs.readFile(absolutePath, 'utf8')))
  const summary = createStatusSummary()
  const rows = []

  for (const city of catalog.cities) {
    for (const source of city.sources) {
      summary[source.status] += 1
      rows.push({
        city: city.cityName,
        year: city.policyYear,
        scope: source.scope,
        status: source.status,
        facts: source.facts?.length || 0,
        network: await checkUrl(source.url),
        title: source.title,
      })
    }
  }

  const result = {
    sourceFile: absolutePath,
    updatedAt: catalog.updatedAt,
    cities: catalog.cities.length,
    sources: rows.length,
    facts: rows.reduce((total, row) => total + row.facts, 0),
    summary,
    gaps: createGapRows(catalog),
    rows,
  }

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  console.table(rows)
  if (showGaps) {
    console.log('\n规则事实缺口：')
    console.table(result.gaps)
  }
  console.log(
    `\n完成：${result.cities} 个城市，${result.sources} 条来源。` +
      ` 已提取 ${result.facts} 条事实。` +
      ` 完整 ${summary.verifiedComplete}，部分核验 ${summary.verifiedPartial}，待解析 ${summary.needsParsing}，待官方来源 ${summary.needsOfficialSource}。`,
  )
  if (!checkNetwork) {
    console.log('提示：追加 --network 可尝试访问来源 URL；默认只做本地结构检查。')
  }
  if (!showGaps) {
    console.log('提示：追加 --gaps 可查看每个城市缺少哪些基数和比例事实。')
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
