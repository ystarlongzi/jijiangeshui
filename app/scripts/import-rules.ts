import fs from 'node:fs/promises'
import path from 'node:path'
import { getPayload } from 'payload'

import config from '../src/payload.config'

type CrawlCity = {
  areaId?: string | number
  areaName?: string
  shortName?: string
  areaCode?: string
  parentAreaId?: string | number
}

type CrawlPolicy = {
  areaId?: string | number
  areaName?: string
  policyYear?: string | number
  effectiveFrom?: string
  baseRulesInfo?: { list?: Array<Record<string, unknown>> }
  itemRulesInfo?: { list?: Array<Record<string, unknown>> }
  externalCodes?: Record<string, unknown>
  status?: string
  errorMessage?: string | null
}

type CrawlResult = {
  cityInfo?: { list?: CrawlCity[] }
  socialInsurancePolicy?: { list?: Array<{ policy?: CrawlPolicy }> }
}

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

async function main() {
  const absolutePath = path.resolve(process.cwd(), inputPath)
  const source = JSON.parse(await fs.readFile(absolutePath, 'utf8')) as CrawlResult
  const cities = source.cityInfo?.list || []
  const policies = source.socialInsurancePolicy?.list || []
  const payload = dryRun ? null : await getPayload({ config })
  let createdCities = 0
  let createdPolicies = 0

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
            provinceName: name,
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

  for (const entry of policies) {
    const policy = entry.policy
    if (!policy?.areaName || policy.policyYear === undefined) continue

    const citySlug = slugify(policy)
    const cityResult = payload
      ? await payload.find({ collection: 'cities', limit: 1, where: { slug: { equals: citySlug } } })
      : { docs: [{ id: `dry-run-city-${citySlug}` }] }
    const cityDoc = cityResult.docs[0]
    if (!cityDoc) {
      console.warn(`跳过 ${policy.areaName}：找不到对应城市。`)
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

  console.log(`完成：${createdCities} 个城市，${createdPolicies} 个政策草稿${dryRun ? '（仅预览，未写入数据库）' : ''}。`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
