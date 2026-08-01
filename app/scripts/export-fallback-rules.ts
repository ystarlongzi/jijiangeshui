import fs from 'node:fs/promises'
import path from 'node:path'

import { cityRules, type CityRule } from '../src/lib/tax-rules'

/**
 * 把代码中的兜底城市规则导出成采集 JSON 格式。
 *
 * 用法：
 * - npm run rules:export-fallback
 * - npm run rules:export-fallback -- ./data/fallback-rules.json
 * - npm run rules:export-fallback -- --output ./data/fallback-rules.json
 *
 * 为什么需要这个脚本：
 * - 前台目前有一份 cityRules 兜底数据
 * - Payload 导入脚本吃的是“采集 JSON”格式
 * - 通过这个脚本可以把两者接起来，用同一套 validate/import 流程检查和导入
 */
type ExportedRule = {
  cityInfo: {
    list: Array<{
      areaId: string
      areaName: string
      shortName: string
      areaCode: string
      parentAreaName: string
    }>
  }
  socialInsurancePolicy: {
    list: Array<{
      areaId: string
      areaName: string
      policyYear: number
      effectiveFrom: string
      baseRulesInfo: { list: Array<{ baseType: string; baseMin: number; baseMax: number }> }
      itemRulesInfo: {
        list: Array<{
          systemType: string
          itemCode: string
          itemName: string
          baseType: string
          employeeCalcMethod: string
          employeeRate?: number
          employeeFixedAmount?: number
          employerCalcMethod: string
          employerRate?: number
          employerFixedAmount?: number
          sortOrder: number
        }>
      }
      status: 'success'
    }>
  }
  crawlJob: {
    status: 'success'
    triggerType: 'manual'
    startedAt: string
    finishedAt: string
  }
}

const outputFlagIndex = process.argv.findIndex((arg) => arg === '--output' || arg === '-o')
const outputPath = outputFlagIndex >= 0 ? process.argv[outputFlagIndex + 1] : process.argv[2]

function getPolicyYear(rule: CityRule) {
  // policyYear 取生效日期年份，例如 2026-07-01 -> 2026。
  return Number(rule.effective.slice(0, 4))
}

function createExportPayload(): ExportedRule {
  const entries = Object.entries(cityRules)
  const now = new Date().toISOString()

  return {
    cityInfo: {
      // cityInfo 相当于城市维表，导入脚本会先用它创建/补齐城市。
      list: entries.map(([slug, rule]) => ({
        areaId: slug,
        areaName: rule.label,
        shortName: rule.name,
        areaCode: rule.pinyin,
        parentAreaName: rule.province,
      })),
    },
    socialInsurancePolicy: {
      // socialInsurancePolicy 是每个城市的具体年度政策，包含基数范围和缴费项目。
      list: entries.map(([slug, rule]) => ({
        areaId: slug,
        areaName: rule.label,
        policyYear: getPolicyYear(rule),
        effectiveFrom: rule.effective,
        baseRulesInfo: {
          // 基数范围按类型输出：social 社保基数，housingFund 公积金基数。
          list: Object.values(rule.baseRules).map((baseRule) => ({
            baseType: baseRule.type,
            baseMin: baseRule.min,
            baseMax: baseRule.max,
          })),
        },
        itemRulesInfo: {
          // 缴费项目按前台计算使用的结构展开，导入时会再转成 Payload 的嵌套字段。
          list: rule.contributionItems.map((item, index) => ({
            systemType: item.systemType,
            itemCode: item.code,
            itemName: item.name,
            baseType: item.baseType,
            employeeCalcMethod: item.employee.method,
            employeeRate: item.employee.rate,
            employeeFixedAmount: item.employee.fixedAmount,
            employerCalcMethod: item.employer.method,
            employerRate: item.employer.rate,
            employerFixedAmount: item.employer.fixedAmount,
            sortOrder: (index + 1) * 10,
          })),
        },
        status: 'success',
      })),
    },
    crawlJob: {
      // 兜底数据不是实时采集结果，但仍然补齐 crawlJob，方便复用校验 schema。
      status: 'success',
      triggerType: 'manual',
      startedAt: now,
      finishedAt: now,
    },
  }
}

async function main() {
  const payload = createExportPayload()
  const content = `${JSON.stringify(payload, null, 2)}\n`

  if (!outputPath) {
    // 不传输出路径时写到 stdout，便于管道处理或快速查看。
    process.stdout.write(content)
    return
  }

  const absolutePath = path.resolve(process.cwd(), outputPath)
  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(absolutePath, content)
  console.log(`已导出 ${payload.cityInfo.list.length} 个城市规则到 ${absolutePath}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
