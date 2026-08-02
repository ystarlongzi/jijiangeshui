import fs from 'node:fs/promises'
import path from 'node:path'
import vm from 'node:vm'

/**
 * Hrwork 社保/公积金规则采集入口。
 *
 * 默认由我们在本地执行这个 Node 脚本，它会复用仓库根目录下的浏览器控制台采集器，
 * 但放进 VM 沙箱里直接请求 Hrwork 接口并输出 JSON。只有当 Hrwork 限制服务端请求时，
 * 才需要让用户去浏览器控制台运行 `scripts/hrwork-social-insurance-console-crawler.js`。
 *
 * 常用命令：
 * - 全量采集：npm run rules:crawl-hrwork -- --all --policy-year 2026 --effective-from 2026-01-01
 * - 单城采集：npm run rules:crawl-hrwork -- --city 北京 --output ./data/hrwork-beijing-2026.json
 * - 小样本验证：npm run rules:crawl-hrwork -- --limit 5
 */
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

  // 这些参数会原样传给控制台采集器。这里把 download 固定为 false，
  // 因为 Node 入口负责写文件，不需要触发浏览器下载。
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

  // 控制台采集器依赖 window/location/fetch/performance 等浏览器全局对象。
  // 在 Node 里用 VM 提供最小可运行环境，避免维护两套采集逻辑。
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

  // 不传 --all 时，只走单城/小样本入口；传 --all 时采集省市列表里的全部城市。
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
