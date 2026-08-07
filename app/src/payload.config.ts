import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { buildConfig } from 'payload'

import { Articles } from './collections/Articles'
import { Cities } from './collections/Cities'
import { FAQs } from './collections/FAQs'
import { ImportJobs } from './collections/ImportJobs'
import { SocialInsurancePolicies } from './collections/SocialInsurancePolicies'
import { SpecialDeductionRules } from './collections/SpecialDeductionRules'
import { TaxRateRules } from './collections/TaxRateRules'
import { Users } from './collections/Users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const configuredPoolMax = Number(process.env.PAYLOAD_DB_POOL_MAX)
const databasePoolMax = Number.isFinite(configuredPoolMax) && configuredPoolMax > 0 ? Math.floor(configuredPoolMax) : 3
const pushDevSchema = process.env.PAYLOAD_DB_PUSH !== 'false'

export default buildConfig({
  admin: {
    user: 'admins',
    importMap: {
      importMapFile: path.resolve(dirname, 'app/(payload)/www-app-admin/importMap.ts'),
    },
    meta: {
      titleSuffix: ' · 极简个税',
      description: '极简个税内容与规则管理后台',
    },
  },
  routes: {
    admin: '/www-app-admin',
  },
  collections: [Users, Cities, SocialInsurancePolicies, TaxRateRules, SpecialDeductionRules, Articles, FAQs, ImportJobs],
  cors: [process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'],
  csrf: [process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'replace-this-secret-before-production',
  db: postgresAdapter({
    // 本地默认保留 Payload 的开发便利模式；生成 migration 时设置 PAYLOAD_DB_PUSH=false，避免新结构先被自动推送。
    push: pushDevSchema,
    pool: {
      connectionString: process.env.DATABASE_URI || '',
      // Next 构建会并行执行多个页面；限制每个 Payload 实例的连接数，避免把本地 Postgres 撞到 max_connections。
      max: databasePoolMax,
    },
  }),
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
