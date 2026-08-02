import fs from 'node:fs/promises'
import path from 'node:path'

import type { Where } from 'payload'
import { getPayload } from 'payload'

import config from '../src/payload.config'

type PayloadInstance = Awaited<ReturnType<typeof getPayload>>

type PublishOptions = {
  clearWarnings: boolean
  citySlug?: string
  dryRun: boolean
  policyYear?: number
}

type PolicyDoc = {
  id: number | string
  city?: number | string | { id?: number | string; slug?: string }
  policyTitle?: string
  policyYear?: number
  effectiveFrom?: string
  policyStatus?: string
  warnings?: Array<{ id?: string; message?: string }>
  baseRules?: unknown[]
  itemRules?: unknown[]
}

const args = process.argv.slice(2)

function getString(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined
}

function normalizeExistingItemCode(item: unknown, index: number) {
  if (!item || typeof item !== 'object') return `unknown-${index + 1}`

  const itemRecord = item as Record<string, unknown>
  const itemCode = getString(itemRecord.itemCode)
  const itemName = getString(itemRecord.itemName) || ''

  if (itemName.includes('补充医疗')) return 'supplementalMedical'
  if (itemName.includes('大病')) return 'majorMedical'

  return itemCode || `unknown-${index + 1}`
}

function normalizeExistingItemRules(itemRules: PolicyDoc['itemRules']) {
  const codeCounts = new Map<string, number>()

  return (itemRules || []).map((item, index) => {
    if (!item || typeof item !== 'object') return item

    const itemCode = normalizeExistingItemCode(item, index)
    const count = (codeCounts.get(itemCode) || 0) + 1
    codeCounts.set(itemCode, count)

    return {
      ...(item as Record<string, unknown>),
      itemCode: count === 1 ? itemCode : `${itemCode}-${index + 1}`,
    }
  })
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

function getFlagValue(name: string) {
  const inlineArg = args.find((arg) => arg.startsWith(`${name}=`))
  if (inlineArg) return inlineArg.slice(name.length + 1)

  const index = args.indexOf(name)
  if (index >= 0) return args[index + 1]

  return undefined
}

function parsePositiveInteger(value: string | undefined, label: string) {
  if (!value) return undefined

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} 必须是正整数，当前值：${value}`)
  }

  return parsed
}

function parseOptions(): PublishOptions {
  return {
    clearWarnings: args.includes('--clear-warnings'),
    citySlug: getFlagValue('--city'),
    dryRun: !args.includes('--write'),
    policyYear: parsePositiveInteger(getFlagValue('--policy-year'), '--policy-year'),
  }
}

function getRelationId(value: PolicyDoc['city']) {
  const id = typeof value === 'number' || typeof value === 'string' ? value : value?.id
  if (typeof id === 'number') return id

  const numericId = Number(id)
  return Number.isFinite(numericId) ? numericId : undefined
}

async function findAllPendingPolicies(payload: PayloadInstance, options: PublishOptions) {
  const filters: Where[] = [{ policyStatus: { equals: 'pendingReview' } }]
  if (options.policyYear) filters.push({ policyYear: { equals: options.policyYear } })

  if (options.citySlug) {
    const cityResult = await payload.find({
      collection: 'cities',
      depth: 0,
      limit: 1,
      where: { slug: { equals: options.citySlug } },
    })
    const city = cityResult.docs[0]
    if (!city) throw new Error(`找不到城市 slug：${options.citySlug}`)
    filters.push({ city: { equals: city.id } })
  }

  const policies: PolicyDoc[] = []
  let page = 1

  while (true) {
    const result = await payload.find({
      collection: 'social-insurance-policies',
      depth: 0,
      draft: true,
      limit: 100,
      page,
      where: { and: filters },
    })

    policies.push(...(result.docs as PolicyDoc[]))
    if (!result.hasNextPage) break
    page += 1
  }

  return policies
}

async function archiveExistingActivePolicies(payload: PayloadInstance, policy: PolicyDoc, options: PublishOptions) {
  const cityId = getRelationId(policy.city)
  if (!cityId || !policy.policyYear) return 0

  const result = await payload.find({
    collection: 'social-insurance-policies',
    depth: 0,
    limit: 20,
    where: {
      and: [
        { city: { equals: cityId } },
        { policyYear: { equals: policy.policyYear } },
        { policyStatus: { equals: 'active' } },
      ],
    },
  })
  const activePolicies = (result.docs as PolicyDoc[]).filter((activePolicy) => String(activePolicy.id) !== String(policy.id))

  if (options.dryRun) return activePolicies.length

  for (const activePolicy of activePolicies) {
    await payload.update({
      collection: 'social-insurance-policies',
      id: activePolicy.id,
      data: {
        policyStatus: 'archived',
        _status: 'published',
      },
      draft: false,
      overrideAccess: true,
    })
  }

  return activePolicies.length
}

async function publishPolicy(payload: PayloadInstance, policy: PolicyDoc, options: PublishOptions) {
  const warnings = policy.warnings || []
  if (warnings.length && !options.clearWarnings) {
    return {
      archived: 0,
      skipped: `存在 ${warnings.length} 条 warning。确认数据可用后追加 --clear-warnings 再发布。`,
    }
  }

  const archived = await archiveExistingActivePolicies(payload, policy, options)
  if (options.dryRun) return { archived, skipped: '' }

  await payload.update({
    collection: 'social-insurance-policies',
    id: policy.id,
    data: {
      policyTitle: policy.policyTitle,
      city: getRelationId(policy.city),
      policyYear: policy.policyYear,
      effectiveFrom: policy.effectiveFrom,
      policyStatus: 'active',
      baseRules: policy.baseRules,
      itemRules: normalizeExistingItemRules(policy.itemRules),
      warnings: options.clearWarnings ? [] : warnings,
      _status: 'published',
    } as never,
    draft: false,
    overrideAccess: true,
  })

  return { archived, skipped: '' }
}

async function main() {
  const options = parseOptions()
  await loadLocalEnv()

  if (!process.env.DATABASE_URI) {
    throw new Error('缺少 DATABASE_URI。请确认 app/.env 已配置并且 PostgreSQL 已启动。')
  }

  const payload = await getPayload({ config })
  const policies = await findAllPendingPolicies(payload, options)
  let published = 0
  let skipped = 0
  let archived = 0
  let failed = 0

  console.log(
    `${options.dryRun ? '预演' : '发布'}社保公积金政策：${policies.length} 条待处理` +
      `${options.policyYear ? `，年度 ${options.policyYear}` : ''}` +
      `${options.citySlug ? `，城市 ${options.citySlug}` : ''}`,
  )

  for (const policy of policies) {
    let result: Awaited<ReturnType<typeof publishPolicy>>
    try {
      result = await publishPolicy(payload, policy, options)
      archived += result.archived
    } catch (error) {
      failed += 1
      console.log(`- 失败：${policy.policyTitle || policy.id}。${(error as Error).message}`)
      continue
    }

    if (result.skipped) {
      skipped += 1
      console.log(`- 跳过：${policy.policyTitle || policy.id}。${result.skipped}`)
      continue
    }

    published += 1
    console.log(`- ${options.dryRun ? '将发布' : '已发布'}：${policy.policyTitle || policy.id}`)
  }

  await payload.destroy()

  console.log(
    `完成：${published} 条${options.dryRun ? '可发布' : '已发布'}，${skipped} 条跳过，${failed} 条失败，${archived} 条旧 active ${
      options.dryRun ? '将归档' : '已归档'
    }。`,
  )
  if (options.dryRun) {
    console.log('当前是 dry-run，确认无误后追加 --write 执行写入。')
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
