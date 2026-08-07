import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 生产环境由 systemd 直接启动 standalone 服务，避免远端依赖完整源码运行。
  output: 'standalone',
}

export default withPayload(nextConfig)
