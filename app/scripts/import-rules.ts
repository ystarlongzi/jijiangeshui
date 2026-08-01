import fs from 'node:fs/promises'
import path from 'node:path'

import {
  normalizePolicyEntry,
  normalizePolicyForCms,
  slugifyRuleEntity,
} from '../src/lib/city-rule-import-normalizer'
import { crawlResultSchema } from '../src/lib/city-rule-import-schema'

/**
 * 将采集或导出的城市社保公积金 JSON 写入 Payload CMS。
 *
 * 用法：
 * - npm run rules:import -- ./data/hrwork.json --dry-run  只预览，不写数据库
 * - npm run rules:import -- ./data/hrwork.json            创建/更新城市和政策草稿
 *
 * 这个脚本只负责把外部数据转成后台可审核的草稿：
 * - 城市不存在时先创建城市
 * - 同一城市 + 年度 + 生效日期的政策存在时更新草稿
 * - 新政策默认进入 pendingReview，避免采集数据直接影响前台计算
 */
const importTriggerTypes = ['manual', 'scheduled', 'retry'] as const
const importSourceTypes = ['fallback', 'manual', 'official', 'hrwork'] as const
type ImportTriggerType = (typeof importTriggerTypes)[number]
type ImportSourceType = (typeof importSourceTypes)[number]
type PayloadInstance = Awaited<ReturnType<typeof import('payload').getPayload>>
type ModuleWithDefault<T> = T | { default?: T }

const inputPath = process.argv[2]
const dryRun = process.argv.includes('--dry-run')

if (!inputPath) {
  throw new Error('请提供采集 JSON 文件，例如：npm run rules:import -- ./data/hrwork.json --dry-run')
}

function normalizeTriggerType(value: unknown): ImportTriggerType {
  return importTriggerTypes.includes(value as ImportTriggerType) ? (value as ImportTriggerType) : 'manual'
}

function normalizeImportSource(value: unknown): ImportSourceType {
  return importSourceTypes.includes(value as ImportSourceType) ? (value as ImportSourceType) : 'manual'
}

function createSourceReviewWarnings(sourceType: ImportSourceType) {
  if (sourceType !== 'hrwork') return []

  return [
    'Hrwork 为第三方聚合来源。本规则可作为批量初始化草稿，发布为有效规则前建议核对城市官方社保、公积金口径。',
  ]
}

function parseEnvValue(value: string) {
  const trimmed = value.trim()
  const quote = trimmed[0]

  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

async function loadLocalEnv() {
  // Next.js dev server 会自动加载 .env；独立 tsx 脚本不会，所以导入前补一层轻量加载。
  for (const fileName of ['.env', '.env.local']) {
    const envPath = path.resolve(process.cwd(), fileName)

    try {
      const content = await fs.readFile(envPath, 'utf8')
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue

        const key = trimmed.slice(0, trimmed.indexOf('=')).trim()
        const value = trimmed.slice(trimmed.indexOf('=') + 1)
        if (key && process.env[key] === undefined) {
          process.env[key] = parseEnvValue(value)
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
}

async function createPayloadClient(): Promise<PayloadInstance> {
  // dry-run 不需要数据库；只有真正导入时才加载 Payload，避免本地预览被后台环境依赖卡住。
  await loadLocalEnv()
  if (!process.env.DATABASE_URI) {
    throw new Error('缺少 DATABASE_URI。请先复制 app/.env.example 为 app/.env，并确认 PostgreSQL 已启动。')
  }

  console.log('正在初始化 Payload 本地 API...')
  const [
    { postgresAdapter },
    { lexicalEditor },
    { buildConfig, getPayload },
    { default: sharp },
    articlesModule,
    citiesModule,
    faqsModule,
    importJobsModule,
    socialInsurancePoliciesModule,
    specialDeductionRulesModule,
    taxRateRulesModule,
    usersModule,
  ] = await Promise.all([
    import('@payloadcms/db-postgres'),
    import('@payloadcms/richtext-lexical'),
    import('payload'),
    import('sharp'),
    import('../src/collections/Articles'),
    import('../src/collections/Cities'),
    import('../src/collections/FAQs'),
    import('../src/collections/ImportJobs'),
    import('../src/collections/SocialInsurancePolicies'),
    import('../src/collections/SpecialDeductionRules'),
    import('../src/collections/TaxRateRules'),
    import('../src/collections/Users'),
  ])
  console.log('Payload 依赖加载完成，正在构建导入配置...')

  const getExport = <T extends Record<string, unknown>, K extends keyof T>(moduleValue: ModuleWithDefault<T>, key: K) => {
    return (moduleValue as T)[key] || (moduleValue as { default?: T }).default?.[key]
  }

  const config = await buildConfig({
    admin: { user: 'admins' },
    collections: [
      getExport(usersModule, 'Users'),
      getExport(citiesModule, 'Cities'),
      getExport(socialInsurancePoliciesModule, 'SocialInsurancePolicies'),
      getExport(taxRateRulesModule, 'TaxRateRules'),
      getExport(specialDeductionRulesModule, 'SpecialDeductionRules'),
      getExport(articlesModule, 'Articles'),
      getExport(faqsModule, 'FAQs'),
      getExport(importJobsModule, 'ImportJobs'),
    ],
    cors: [process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'],
    csrf: [process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'],
    editor: lexicalEditor(),
    secret: process.env.PAYLOAD_SECRET || 'replace-this-secret-before-production',
    db: postgresAdapter({
      pool: {
        connectionString: process.env.DATABASE_URI,
      },
    }),
    sharp,
  })

  const payload = await getPayload({ config })
  console.log('Payload 本地 API 已连接。')
  return payload
}

async function main() {
  const absolutePath = path.resolve(process.cwd(), inputPath)
  const source = crawlResultSchema.parse(JSON.parse(await fs.readFile(absolutePath, 'utf8')))
  const cities = source.cityInfo?.list || []
  const policies = (source.socialInsurancePolicy?.list || []).map(normalizePolicyEntry)
  const cityByAreaId = new Map(cities.map((city) => [city.areaId ? String(city.areaId) : '', city]).filter(([areaId]) => areaId))
  const importSource = normalizeImportSource(source.crawlJob?.source)
  const payload = dryRun ? null : await createPayloadClient()
  let createdCities = 0
  let createdPolicies = 0
  let failedPolicies = 0
  const importWarnings: Array<{ message: string }> = []

  for (const city of cities) {
    // 先确保城市维表存在。政策表只存 city id，不直接存城市文本。
    const name = city.areaName?.trim()
    if (!name) continue
    const slug = slugifyRuleEntity(city)
    const existing = payload
      ? await payload.find({ collection: 'cities', limit: 1, where: { slug: { equals: slug } } })
      : { docs: [] }

    if (!existing.docs.length) {
      createdCities += 1
      if (payload) {
        await payload.create({
          collection: 'cities',
          data: {
            name,
            slug,
            provinceName: city.parentAreaName || name,
            level: 'city',
            areaId: city.areaId ? String(city.areaId) : undefined,
            parentAreaId: city.parentAreaId ? String(city.parentAreaId) : undefined,
            areaCode: city.areaCode,
            shortName: city.shortName,
            enabled: true,
          },
        })
      }
    }
    if (payload && createdCities > 0 && createdCities % 50 === 0) {
      console.log(`城市已创建 ${createdCities} 个...`)
    }
  }

  for (const policy of policies) {
    if (!policy?.areaName || policy.policyYear === undefined) continue

    const matchedCity = policy.areaId ? cityByAreaId.get(String(policy.areaId)) : undefined
    const citySlug = matchedCity ? slugifyRuleEntity(matchedCity) : slugifyRuleEntity(policy)
    const cityResult = payload
      ? await payload.find({ collection: 'cities', limit: 1, where: { slug: { equals: citySlug } } })
      : { docs: [{ id: `dry-run-city-${citySlug}` }] }
    const cityDoc = cityResult.docs[0]
    if (!cityDoc) {
      const message = `跳过 ${policy.areaName}：找不到对应城市。`
      failedPolicies += 1
      importWarnings.push({ message })
      console.warn(message)
      continue
    }

    const normalizedPolicy = normalizePolicyForCms(policy)
    // 采集失败或部分失败不阻断导入，但会写入 warnings，方便后台审核时看到风险。
    const warningMessages = [
      ...createSourceReviewWarnings(importSource),
      ...(policy.status && policy.status !== 'success' ? [`采集状态：${policy.status}`] : []),
      ...(policy.errorMessage ? [policy.errorMessage] : []),
    ]
    const data = {
      policyTitle: `${policy.areaName} ${policy.policyYear} 年社保公积金规则`,
      city: cityDoc.id,
      policyYear: normalizedPolicy.policyYear,
      effectiveFrom: normalizedPolicy.effectiveFrom,
      policyStatus: 'pendingReview',
      source: normalizedPolicy.source,
      baseRules: normalizedPolicy.baseRules,
      itemRules: normalizedPolicy.itemRules,
      warnings: warningMessages.map((message) => ({ message })),
      rawData: policy,
    }

    createdPolicies += 1
    if (dryRun) {
      // dry-run 用于检查映射结果，不连接数据库，也不会创建 Payload 文档。
      console.log(`[dry-run] ${data.policyTitle}：${data.baseRules.length} 个基数规则，${data.itemRules.length} 个缴费项目`)
      continue
    }

    const cms = payload
    if (!cms) throw new Error('导入任务未初始化 Payload。')

    const existingPolicy = await cms.find({
      collection: 'social-insurance-policies',
      limit: 1,
      where: {
        and: [
          { city: { equals: cityDoc.id } },
          { policyYear: { equals: data.policyYear } },
          { effectiveFrom: { equals: data.effectiveFrom } },
        ],
      },
    })

    if (existingPolicy.docs[0]) {
      // 同一政策版本重复导入时更新草稿，避免后台出现多条同版本规则。
      await cms.update({
        collection: 'social-insurance-policies',
        id: existingPolicy.docs[0].id,
        data,
        draft: true,
      })
    } else {
      await cms.create({ collection: 'social-insurance-policies', data, draft: true })
    }

    if (payload && createdPolicies > 0 && createdPolicies % 50 === 0) {
      console.log(`政策草稿已处理 ${createdPolicies} 条...`)
    }
  }

  if (payload) {
    await payload.create({
      collection: 'import-jobs',
      data: {
        jobTitle: `社保公积金规则导入 ${new Date().toISOString().slice(0, 10)}`,
        source: importSource,
        status: failedPolicies > 0 ? 'partialSuccess' : 'success',
        triggerType: normalizeTriggerType(source.crawlJob?.triggerType),
        startedAt: source.crawlJob?.startedAt,
        finishedAt: new Date().toISOString(),
        totalCities: policies.length,
        successCities: createdPolicies,
        failedCities: failedPolicies,
        sourceFile: absolutePath,
        warnings: importWarnings,
        errorMessage: failedPolicies > 0 ? `${failedPolicies} 个政策未导入。` : undefined,
      },
    })
  }

  console.log(`完成：${createdCities} 个城市，${createdPolicies} 个政策草稿${dryRun ? '（仅预览，未写入数据库）' : ''}。`)
  await payload?.destroy()
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
