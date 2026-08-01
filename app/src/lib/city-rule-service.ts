import 'server-only'

import { getPayload } from 'payload'

import config from '@payload-config'
import { adaptCmsPolicyToCityRule } from './city-rule-adapter'
import { cityRules, type CityRule } from './tax-rules'

type CityRuleMap = Record<string, CityRule>

type CmsCityDoc = {
  id: string | number
  name?: string | null
  slug?: string | null
  provinceName?: string | null
  shortName?: string | null
}

type CmsPolicyDoc = Parameters<typeof adaptCmsPolicyToCityRule>[0]

export async function getAvailableCityRules(): Promise<CityRuleMap> {
  if (!process.env.DATABASE_URI) return cityRules

  try {
    return await readCityRulesFromPayload()
  } catch (error) {
    console.warn('读取 Payload 城市规则失败，已回退到内置规则。', error)
    return cityRules
  }
}

export async function getAvailableCityRule(slug: string): Promise<CityRule | undefined> {
  const rules = await getAvailableCityRules()
  return rules[slug]
}

async function readCityRulesFromPayload(): Promise<CityRuleMap> {
  const payload = await getPayload({ config })
  const cityResult = await payload.find({
    collection: 'cities',
    depth: 0,
    limit: 500,
    where: { enabled: { equals: true } },
  })
  const rules: CityRuleMap = { ...cityRules }

  for (const city of cityResult.docs as CmsCityDoc[]) {
    if (!city.slug) continue
    const policyResult = await payload.find({
      collection: 'social-insurance-policies',
      depth: 0,
      limit: 1,
      sort: '-effectiveFrom',
      where: {
        and: [
          { city: { equals: city.id } },
          { policyStatus: { equals: 'active' } },
        ],
      },
    })
    const policy = policyResult.docs[0] as CmsPolicyDoc | undefined

    if (policy) {
      rules[city.slug] = adaptCmsPolicyToCityRule(policy, city)
    }
  }

  return rules
}
