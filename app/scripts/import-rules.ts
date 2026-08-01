import fs from 'node:fs/promises'
import path from 'node:path'

import {
  crawlResultSchema,
  wrappedPolicySchema,
  type CrawlCity,
  type CrawlPolicy,
  type CrawlPolicyEntry,
  type WrappedPolicy,
} from '../src/lib/city-rule-import-schema'

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
type ImportTriggerType = (typeof importTriggerTypes)[number]
type PayloadInstance = Awaited<ReturnType<typeof import('payload').getPayload>>

const inputPath = process.argv[2]
const dryRun = process.argv.includes('--dry-run')

if (!inputPath) {
  throw new Error('请提供采集 JSON 文件，例如：npm run rules:import -- ./data/hrwork.json --dry-run')
}

function slugify(city: CrawlCity | CrawlPolicy) {
  // 优先使用 areaCode/areaId 这类稳定标识；没有时才退回城市名。
  // 这里生成的 slug 需要和城市集合中的 slug 保持一致，后面政策导入会靠它关联城市。
  const source = ('areaCode' in city ? city.areaCode : undefined) || city.areaId || city.areaName || 'unknown-city'
  return String(source)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function numberOrNull(value: unknown) {
  // 外部采集数据可能出现空字符串、null 或缺字段；统一转成后台字段可接受的 number/null。
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeItemRule(item: Record<string, unknown>, index: number) {
  // 把采集端的扁平字段转换成 Payload collection 里的 employee/employer 嵌套结构。
  // systemType 会影响默认基数类型：公积金使用 housingFund，企业成本不参与个人基数计算。
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
  // 兼容两种输入：直接 policy 对象，或 { policy, ...meta } 包裹对象。
  return wrappedPolicySchema.safeParse(entry).success
}

function normalizePolicyEntry(entry: CrawlPolicyEntry): CrawlPolicy {
  return isWrappedPolicyEntry(entry) ? entry.policy : entry
}

function normalizeTriggerType(value: unknown): ImportTriggerType {
  return importTriggerTypes.includes(value as ImportTriggerType) ? (value as ImportTriggerType) : 'manual'
}

function normalizePolicySource(policy: CrawlPolicy) {
  return {
    title: policy.source?.title || `${policy.areaName || '未知城市'}社保公积金规则来源待补充`,
    url: policy.source?.url,
    checkedAt: policy.source?.checkedAt || new Date().toISOString(),
    remark: policy.source?.remark,
  }
}

async function createPayloadClient(): Promise<PayloadInstance> {
  // dry-run 不需要数据库；只有真正导入时才加载 Payload，避免本地预览被后台环境依赖卡住。
  const [{ getPayload }, { default: config }] = await Promise.all([import('payload'), import('../src/payload.config')])
  return getPayload({ config })
}

async function main() {
  const absolutePath = path.resolve(process.cwd(), inputPath)
  const source = crawlResultSchema.parse(JSON.parse(await fs.readFile(absolutePath, 'utf8')))
  const cities = source.cityInfo?.list || []
  const policies = (source.socialInsurancePolicy?.list || []).map(normalizePolicyEntry)
  const payload = dryRun ? null : await createPayloadClient()
  let createdCities = 0
  let createdPolicies = 0
  let failedPolicies = 0
  const importWarnings: Array<{ message: string }> = []

  for (const city of cities) {
    // 先确保城市维表存在。政策表只存 city id，不直接存城市文本。
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
    // 采集失败或部分失败不阻断导入，但会写入 warnings，方便后台审核时看到风险。
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
      source: normalizePolicySource(policy),
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
