import fs from 'node:fs/promises'
import path from 'node:path'

import { canonicalCitySlug, isCitySlugAlias } from '../src/lib/city-slugs'

type PayloadClient = Awaited<ReturnType<typeof import('payload').getPayload>>
type CityDoc = {
  id: string | number
  slug?: string | null
  name?: string | null
  enabled?: boolean | null
}
type PolicyDoc = {
  id: string | number
}

const write = process.argv.includes('--write')
const json = process.argv.includes('--json')

async function loadLocalEnv() {
  for (const fileName of ['.env', '.env.local']) {
    const envPath = path.resolve(process.cwd(), fileName)
    try {
      const content = await fs.readFile(envPath, 'utf8')
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
        const key = trimmed.slice(0, trimmed.indexOf('=')).trim()
        const value = trimmed.slice(trimmed.indexOf('=') + 1).trim()
        if (key && process.env[key] === undefined) process.env[key] = value.replace(/^(['"])(.*)\1$/, '$2')
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
}

async function createPayloadClient() {
  await loadLocalEnv()
  if (!process.env.DATABASE_URI) throw new Error('缺少 DATABASE_URI，无法读取 CMS 城市。')
  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('../src/payload.config'),
  ])
  return getPayload({ config })
}

async function main() {
  const payload = await createPayloadClient()
  try {
    const cityResult = await payload.find({ collection: 'cities', depth: 0, limit: 1000 })
    const cities = cityResult.docs as CityDoc[]
    const changes: Array<{ city: CityDoc; canonicalSlug: string; target?: CityDoc; policyCount: number }> = []

    for (const city of cities) {
      if (!city.slug || !isCitySlugAlias(city.slug)) continue
      const canonicalSlug = canonicalCitySlug(city.slug)
      const target = cities.find((candidate) => candidate.id !== city.id && candidate.slug === canonicalSlug)
      const policies = target
        ? await payload.find({
            collection: 'social-insurance-policies',
            depth: 0,
            limit: 2000,
            where: { city: { equals: city.id } },
          })
        : { docs: [] as PolicyDoc[] }
      changes.push({ city, canonicalSlug, target, policyCount: policies.docs.length })

      if (!write) continue
      if (target) {
        for (const policy of policies.docs as PolicyDoc[]) {
          await payload.update({ collection: 'social-insurance-policies', id: policy.id, data: { city: normalizePayloadId(target.id) }, draft: false })
        }
        await payload.update({
          collection: 'cities',
          id: city.id,
          data: { slug: `${canonicalSlug}-legacy-${city.id}`, enabled: false },
        })
      } else {
        await payload.update({ collection: 'cities', id: city.id, data: { slug: canonicalSlug } })
      }
    }

    const summary = {
      mode: write ? 'write' : 'dry-run',
      aliases: changes.map(({ city, canonicalSlug, target, policyCount }) => ({
        id: city.id,
        name: city.name,
        from: city.slug,
        to: target ? `${canonicalSlug}-legacy-${city.id}` : canonicalSlug,
        mergedInto: target?.id || null,
        policiesReassigned: policyCount,
      })),
      changed: changes.length,
    }
    if (json) console.log(JSON.stringify(summary, null, 2))
    else if (changes.length === 0) console.log('没有发现需要归一化的城市 slug。')
    else {
      console.log(`${write ? '已处理' : '待处理'} ${changes.length} 个城市 slug：`)
      for (const item of summary.aliases) {
        const suffix = item.mergedInto ? `，已准备把 ${item.policiesReassigned} 条政策迁移到城市 ${item.mergedInto}` : ''
        console.log(`- ${item.name || item.id}：${item.from} → ${item.to}${suffix}`)
      }
      if (!write) console.log('当前为 dry-run；确认备份后追加 --write 执行。')
    }
  } finally {
    await payload.destroy()
  }
}

function normalizePayloadId(value: string | number) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new Error(`无法识别 Payload 关系 id：${String(value)}`)
  return id
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode || 0), 0)
  })
