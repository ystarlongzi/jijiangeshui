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

export default buildConfig({
  admin: {
    user: 'admins',
    meta: {
      titleSuffix: ' · 极简个税',
      description: '极简个税内容与规则管理后台',
    },
  },
  collections: [Users, Cities, SocialInsurancePolicies, TaxRateRules, SpecialDeductionRules, Articles, FAQs, ImportJobs],
  cors: [process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'],
  csrf: [process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'replace-this-secret-before-production',
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
