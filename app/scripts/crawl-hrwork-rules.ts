import fs from 'node:fs/promises'
import path from 'node:path'
import vm from 'node:vm'

type CrawlOptions = {
  cityFilter?: string
  concurrency?: number
  delayMs?: number
  download: boolean
  effectiveFrom?: string
  limit?: number
  policyYear?: string
  triggerType: 'manual'
}

const args = process.argv.slice(2)

function readArg(name: string) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function hasArg(name: string) {
  return args.includes(name)
}

function numberArg(name: string) {
  const value = readArg(name)
  if (value === undefined) return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`${name} 需要传入数字。`)
  return parsed
}

async function main() {
  const rootDir = path.resolve(process.cwd(), '..')
  const crawlerPath = path.resolve(rootDir, 'scripts/hrwork-social-insurance-console-crawler.js')
  const today = new Date().toISOString().slice(0, 10)
  const outputPath = path.resolve(
    process.cwd(),
    readArg('--output') || `./data/hrwork-social-insurance-${today}.json`,
  )
  const policyYear = readArg('--policy-year') || String(new Date().getFullYear())
  const options: CrawlOptions = {
    cityFilter: readArg('--city'),
    concurrency: numberArg('--concurrency') ?? 3,
    delayMs: numberArg('--delay-ms') ?? 500,
    download: false,
    effectiveFrom: readArg('--effective-from') || `${policyYear}-01-01`,
    limit: numberArg('--limit'),
    policyYear,
    triggerType: 'manual',
  }

  const sandbox = {
    Blob,
    console,
    fetch,
    location: { hostname: 'web.hrwork.com' },
    performance,
    setTimeout,
    window: {} as {
      crawlAllHrworkSocialInsuranceRules?: (options: CrawlOptions) => Promise<unknown>
      crawlHrworkSocialInsuranceRules?: (options: CrawlOptions) => Promise<unknown>
    },
  }
  vm.createContext(sandbox)
  vm.runInContext(await fs.readFile(crawlerPath, 'utf8'), sandbox, { filename: crawlerPath })

  const crawl = hasArg('--all')
    ? sandbox.window.crawlAllHrworkSocialInsuranceRules
    : sandbox.window.crawlHrworkSocialInsuranceRules

  if (!crawl) throw new Error('Hrwork 爬虫加载失败。')

  console.log(`开始采集 Hrwork 社保公积金规则，输出文件：${outputPath}`)
  const result = await crawl(options)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2))
  console.log(`完成：${outputPath}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
