import fs from 'node:fs/promises'
import path from 'node:path'
import { getPayload } from 'payload'
import { z } from 'zod'

import config from '../src/payload.config'

const idSchema = z.union([z.string(), z.number()])
const rawRecordSchema = z.record(z.string(), z.unknown())

const crawlCitySchema = z
  .object({
    areaId: idSchema.optional(),
    areaName: z.string().optional(),
    shortName: z.string().optional(),
    areaCode: z.string().optional(),
    parentAreaId: idSchema.optional(),
    parentAreaName: z.string().optional(),
  })
  .passthrough()

const crawlPolicySchema = z
  .object({
    areaId: idSchema.optional(),
    areaName: z.string().optional(),
    policyYear: idSchema.optional(),
    effectiveFrom: z.string().optional(),
    baseRulesInfo: z.object({ list: z.array(rawRecordSchema).optional() }).optional(),
    itemRulesInfo: z.object({ list: z.array(rawRecordSchema).optional() }).optional(),
    externalCodes: rawRecordSchema.optional(),
    status: z.string().optional(),
    errorMessage: z.string().nullable().optional(),
  })
  .passthrough()

const wrappedPolicySchema = z.object({ policy: crawlPolicySchema }).passthrough()
const crawlPolicyEntrySchema = z.union([wrappedPolicySchema, crawlPolicySchema])

const crawlResultSchema = z
  .object({
    cityInfo: z.object({ list: z.array(crawlCitySchema).optional() }).optional(),
    socialInsurancePolicy: z.object({ list: z.array(crawlPolicyEntrySchema).optional() }).optional(),
    crawlJob: z
      .object({
        status: z.string().optional(),
        triggerType: z.string().optional(),
        startedAt: z.string().optional(),
        finishedAt: z.string().optional(),
        errorMessage: z.string().nullable().optional(),
      })
      .optional(),
  })
  .passthrough()

type CrawlCity = z.infer<typeof crawlCitySchema>
type CrawlPolicy = z.infer<typeof crawlPolicySchema>
type CrawlPolicyEntry = z.infer<typeof crawlPolicyEntrySchema>
type WrappedPolicy = z.infer<typeof wrappedPolicySchema>

const importTriggerTypes = ['manual', 'scheduled', 'retry'] as const
type ImportTriggerType = (typeof importTriggerTypes)[number]

const inputPath = process.argv[2]
const dryRun = process.argv.includes('--dry-run')

if (!inputPath) {
  throw new Error('请提供采集 JSON 文件，例如：npm run rules:import -- ./data/hrwork.json --dry-run')
}

function slugify(city: CrawlCity | CrawlPolicy) {
  const source = ('areaCode' in city ? city.areaCode : undefined) || city.areaId || city.areaName || 'unknown-city'
  return String(source)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeItemRule(item: Record<string, unknown>, index: number) {
  return {
    systemType: item.systemType || 'social',
    itemCode: item.itemCode || `unknown-${index + 1}`,
    itemName: item.itemName || `未命名项目 ${index + 1}`,
    baseType: item.systemType === 'housingFund' ? 'housingFund' : item.systemType === 'employerCost' ? 'none' : 'social',
    employee: {
      calcMethod: item.employeeCalcMethod || 'none',
      rate: numberOrNull(item.employeeRate),
      fixedAmount: numberOrNull(item.employeeFixedAmount),
    },
    employer: {
      calcMethod: item.employerCalcMethod || 'none',
      rate: numberOrNull(item.employerRate),
      fixedAmount: numberOrNull(item.employerFixedAmount),
    },
    sortOrder: numberOrNull(item.sortOrder) ?? (index + 1) * 10,
  }
}

function isWrappedPolicyEntry(entry: CrawlPolicyEntry): entry is WrappedPolicy {
  return wrappedPolicySchema.safeParse(entry).success
}

function normalizePolicyEntry(entry: CrawlPolicyEntry): CrawlPolicy {
  return isWrappedPolicyEntry(entry) ? entry.policy : entry
}

function normalizeTriggerType(value: unknown): ImportTriggerType {
  return importTriggerTypes.includes(value as ImportTriggerType) ? (value as ImportTriggerType) : 'manual'
}

async function main() {
  const absolutePath = path.resolve(process.cwd(), inputPath)
  const source = crawlResultSchema.parse(JSON.parse(await fs.readFile(absolutePath, 'utf8')))
  const cities = source.cityInfo?.list || []
  const policies = (source.socialInsurancePolicy?.list || []).map(normalizePolicyEntry)
  const payload = dryRun ? null : await getPayload({ config })
  let createdCities = 0
  let createdPolicies = 0
  let failedPolicies = 0
  const importWarnings: Array<{ message: string }> = []

  for (const city of cities) {
    const name = city.areaName?.trim()
    if (!name) continue
    const slug = slugify(city)
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
  }

  for (const policy of policies) {
    if (!policy?.areaName || policy.policyYear === undefined) continue

    const citySlug = slugify(policy)
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

    const baseRules = policy.baseRulesInfo?.list || []
    const itemRules = policy.itemRulesInfo?.list || []
    const warningMessages = [
      ...(policy.status && policy.status !== 'success' ? [`采集状态：${policy.status}`] : []),
      ...(policy.errorMessage ? [policy.errorMessage] : []),
    ]
    const data = {
      policyTitle: `${policy.areaName} ${policy.policyYear} 年社保公积金规则`,
      city: cityDoc.id,
      policyYear: Number(policy.policyYear),
      effectiveFrom: policy.effectiveFrom || `${policy.policyYear}-01-01`,
      policyStatus: 'pendingReview',
      source: {
        title: 'Hrwork 社保公积金接口采集',
        url: 'https://web.hrwork.com',
        checkedAt: new Date().toISOString(),
      },
      baseRules: baseRules.map((rule) => ({
        baseType: rule.baseType || 'social',
        baseMin: numberOrNull(rule.baseMin) ?? 0,
        baseMax: numberOrNull(rule.baseMax) ?? 0,
      })),
      itemRules: itemRules.map(normalizeItemRule),
      warnings: warningMessages.map((message) => ({ message })),
      rawData: policy,
    }

    createdPolicies += 1
    if (dryRun) {
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
      await cms.update({
        collection: 'social-insurance-policies',
        id: existingPolicy.docs[0].id,
        data,
        draft: true,
      })
    } else {
      await cms.create({ collection: 'social-insurance-policies', data, draft: true })
    }
  }

  if (payload) {
    await payload.create({
      collection: 'import-jobs',
      data: {
        jobTitle: `社保公积金规则导入 ${new Date().toISOString().slice(0, 10)}`,
        source: 'hrwork',
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
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
