import { spawn } from 'node:child_process'
import path from 'node:path'

const port = Number(process.env.SMOKE_PORT || 4100)
const baseUrl = `http://127.0.0.1:${port}`
const nextBin = path.resolve(process.cwd(), 'node_modules/next/dist/bin/next')

type SmokeCheck = {
  path: string
  status: number
  contains?: string
  titleContains?: string
}

const checks: SmokeCheck[] = [
  { path: '/', status: 200, contains: '工资' },
  { path: '/calculator', status: 200, contains: '工资' },
  { path: '/reverse-tax', status: 200, contains: '反推' },
  { path: '/tax-rate', status: 200, contains: '税率' },
  { path: '/tax-rate?type=labor&identity=non-resident&year=2026', status: 200, contains: '非居民个人劳务报酬', titleContains: '非居民个人劳务报酬' },
  { path: '/labor-tax', status: 200, contains: '劳务报酬' },
  { path: '/dividend-tax', status: 200, contains: '股息' },
  { path: '/sitemap.xml', status: 200, contains: 'type=dividend' },
  { path: '/special-deductions', status: 200, contains: '专项' },
  // 使用非法参数验证 API 路由已经部署，避免冒烟测试依赖第三方地理编码服务。
  { path: '/api/location/reverse?lat=invalid&lon=invalid', status: 400 },
]

async function main() {
  const server = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let serverOutput = ''
  server.stdout.on('data', (chunk) => { serverOutput += String(chunk) })
  server.stderr.on('data', (chunk) => { serverOutput += String(chunk) })

  try {
    await waitForServer()

    for (const check of checks) {
      const response = await fetch(`${baseUrl}${check.path}`, { signal: AbortSignal.timeout(8000) })
      const body = await response.text()
      if (response.status !== check.status) {
        throw new Error(`${check.path} 返回 HTTP ${response.status}，预期 ${check.status}。`)
      }
      if (check.contains && !body.includes(check.contains)) {
        throw new Error(`${check.path} 未找到页面关键文案“${check.contains}”。`)
      }
      if (check.titleContains) {
        const title = body.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''
        if (!title.includes(check.titleContains)) throw new Error(`${check.path} 的页面标题未包含“${check.titleContains}”。`)
      }
      console.log(`通过：${check.path} -> ${response.status}`)
    }

    console.log(`完成：${checks.length} 项生产页面/API 冒烟检查。`)
  } catch (error) {
    const detail = serverOutput.trim().split(/\r?\n/).slice(-8).join('\n')
    if (detail) console.error(detail)
    throw error
  } finally {
    // 冒烟测试启动的是临时生产进程，结束后必须释放端口，避免影响后续本地开发。
    server.kill('SIGTERM')
  }
}

async function waitForServer() {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    try {
      // 启动探针使用轻量静态路由，避免首页首次渲染较慢时把“服务已启动”误判为失败。
      const response = await fetch(`${baseUrl}/robots.txt`, { signal: AbortSignal.timeout(2000) })
      if (response.status < 500) return
    } catch {
      // Next.js 启动期间端口尚未可用，继续短暂轮询。
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`生产服务在 30 秒内没有启动：${baseUrl}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
