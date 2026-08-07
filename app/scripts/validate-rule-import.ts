import fs from 'node:fs/promises'
import path from 'node:path'

import {
  crawlResultSchema,
  wrappedPolicySchema,
  type CrawlPolicy,
  type CrawlPolicyEntry,
  type WrappedPolicy,
} from '../src/lib/city-rule-import-schema'

/**
 * 校验采集 JSON 是否满足导入社保公积金规则的最低要求。
 *
 * 用法：
 * - npm run rules:validate -- ./data/hrwork.json
 * - npm run rules:validate -- ./data/hrwork.json --json
 *
 * 注意：这里不是校验“政策数字一定正确”，而是校验结构和关键字段是否完整：
 * 城市、年度、生效日期、缴费基数范围、缴费项目、采集状态等。
 */
const inputPath = process.argv[2]
const jsonOutput = process.argv.includes('--json')

if (!inputPath) {
  throw new Error('请提供采集 JSON 文件，例如：npm run rules:validate -- ./data/hrwork.json')
}

function isWrappedPolicyEntry(entry: CrawlPolicyEntry): entry is WrappedPolicy {
  // 兼容导入源可能返回 { policy } 包裹结构的情况。
  return wrappedPolicySchema.safeParse(entry).success
}

function normalizePolicyEntry(entry: CrawlPolicyEntry): CrawlPolicy {
  return isWrappedPolicyEntry(entry) ? entry.policy : entry
}

function countPolicyIssues(policy: CrawlPolicy) {
  // 收集会影响导入和后台审核的关键问题。错误越早暴露，越少污染 CMS 草稿数据。
  const issues: string[] = []
  const baseRules = policy.baseRulesInfo?.list || []
  const itemRules = policy.itemRulesInfo?.list || []

  if (!policy.areaName) issues.push('缺少城市名称')
  if (policy.policyYear === undefined) issues.push('缺少政策年度')
  if (!policy.effectiveFrom) issues.push('缺少生效日期')
  if (!baseRules.length) issues.push('缺少缴费基数范围')
  if (!itemRules.length) issues.push('缺少缴费项目')
  if (policy.status && policy.status !== 'success') issues.push(`采集状态异常：${policy.status}`)
  if (policy.errorMessage) issues.push(policy.errorMessage)

  return issues
}

async function main() {
  const absolutePath = path.resolve(process.cwd(), inputPath)
  const parsed = crawlResultSchema.parse(JSON.parse(await fs.readFile(absolutePath, 'utf8')))
  const cities = parsed.cityInfo?.list || []
  const policies = (parsed.socialInsurancePolicy?.list || []).map(normalizePolicyEntry)
  const issueRows = policies
    .map((policy) => ({
      city: policy.areaName || '未知城市',
      policyYear: policy.policyYear || '-',
      issues: countPolicyIssues(policy),
    }))
    .filter((row) => row.issues.length)

  const summary = {
    sourceFile: absolutePath,
    cities: cities.length,
    policies: policies.length,
    policiesWithIssues: issueRows.length,
    crawlStatus: parsed.crawlJob?.status || 'unknown',
  }

  if (jsonOutput) {
    // 给 CI 或后续脚本消费时使用 JSON 输出；人工本地检查默认使用 console.table。
    console.log(JSON.stringify({ summary, issues: issueRows }, null, 2))
    return
  }

  console.table([summary])
  if (issueRows.length) {
    // 有问题时返回非 0，便于在自动化流程里阻断后续导入。
    console.log('\n需要处理的政策：')
    issueRows.forEach((row) => {
      console.log(`- ${row.city} ${row.policyYear}：${row.issues.join('；')}`)
    })
    process.exitCode = 1
    return
  }

  console.log('\n采集 JSON 格式和关键字段通过校验。')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
