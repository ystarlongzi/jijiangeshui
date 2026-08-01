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

const inputPath = process.argv[2] || './data/city-rule-sources.json'
const checkNetwork = process.argv.includes('--network')
const jsonOutput = process.argv.includes('--json')

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
    summary,
    rows,
  }

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  console.table(rows)
  console.log(
    `\n完成：${result.cities} 个城市，${result.sources} 条来源。` +
      ` 完整 ${summary.verifiedComplete}，部分核验 ${summary.verifiedPartial}，待解析 ${summary.needsParsing}，待官方来源 ${summary.needsOfficialSource}。`,
  )
  if (!checkNetwork) {
    console.log('提示：追加 --network 可尝试访问来源 URL；默认只做本地结构检查。')
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
