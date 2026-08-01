import fs from 'node:fs/promises'
import path from 'node:path'

import { cityRules, type CityRule } from '../src/lib/tax-rules'

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
  return Number(rule.effective.slice(0, 4))
}

function createExportPayload(): ExportedRule {
  const entries = Object.entries(cityRules)
  const now = new Date().toISOString()

  return {
    cityInfo: {
      list: entries.map(([slug, rule]) => ({
        areaId: slug,
        areaName: rule.label,
        shortName: rule.name,
        areaCode: rule.pinyin,
        parentAreaName: rule.province,
      })),
    },
    socialInsurancePolicy: {
      list: entries.map(([slug, rule]) => ({
        areaId: slug,
        areaName: rule.label,
        policyYear: getPolicyYear(rule),
        effectiveFrom: rule.effective,
        baseRulesInfo: {
          list: Object.values(rule.baseRules).map((baseRule) => ({
            baseType: baseRule.type,
            baseMin: baseRule.min,
            baseMax: baseRule.max,
          })),
        },
        itemRulesInfo: {
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
