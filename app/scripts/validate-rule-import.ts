import fs from 'node:fs/promises'
import path from 'node:path'

import {
  crawlResultSchema,
  wrappedPolicySchema,
  type CrawlPolicy,
  type CrawlPolicyEntry,
  type WrappedPolicy,
} from '../src/lib/city-rule-import-schema'

const inputPath = process.argv[2]
const jsonOutput = process.argv.includes('--json')

if (!inputPath) {
  throw new Error('请提供采集 JSON 文件，例如：npm run rules:validate -- ./data/hrwork.json')
}

function isWrappedPolicyEntry(entry: CrawlPolicyEntry): entry is WrappedPolicy {
  return wrappedPolicySchema.safeParse(entry).success
}

function normalizePolicyEntry(entry: CrawlPolicyEntry): CrawlPolicy {
  return isWrappedPolicyEntry(entry) ? entry.policy : entry
}

function countPolicyIssues(policy: CrawlPolicy) {
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
    console.log(JSON.stringify({ summary, issues: issueRows }, null, 2))
    return
  }

  console.table([summary])
  if (issueRows.length) {
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
