import 'server-only'

import { unstable_cache } from 'next/cache'
import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'
import { getPayload } from 'payload'

import config from '@payload-config'

export type PublicFaq = {
  question: string
  slug: string
  category: string
  answer: string
  sortOrder: number
}

type CmsFaqDoc = {
  question?: string | null
  slug?: string | null
  category?: string | null
  answer?: unknown
  sortOrder?: number | null
}

const FALLBACK_FAQS: PublicFaq[] = [
  {
    question: '为什么工资一样，每个月个税不一样？',
    slug: 'monthly-tax-is-different',
    category: 'salary-tax',
    answer: '工资薪金通常采用累计预扣法。累计收入、累计扣除和已预扣税额会随着月份变化，因此本月税额不一定固定。',
    sortOrder: 10,
  },
  {
    question: '社保缴费基数可以和工资不一样吗？',
    slug: 'social-base-different-from-salary',
    category: 'social-housing',
    answer: '可以。不同城市和单位可能有不同申报基数，但通常需要在对应城市政策允许范围内。',
    sortOrder: 20,
  },
  {
    question: '全年个税和年度汇算是一回事吗？',
    slug: 'annual-tax-and-settlement',
    category: 'salary-tax',
    answer: '不是。全年个税通常指全年预扣合计估算，年度汇算最终结果还会受到综合所得、专项扣除和其他收入等因素影响。',
    sortOrder: 30,
  },
  {
    question: '计算结果和工资条不一致怎么办？',
    slug: 'calculator-result-differs-from-payroll',
    category: 'salary-tax',
    answer: '请检查缴费城市、入职月份、社保公积金基数、比例、奖金和专项附加扣除。计算器结果仅供测算，最终以扣缴单位和税务机关口径为准。',
    sortOrder: 40,
  },
]

const readCachedFaqs = unstable_cache(
  async (): Promise<PublicFaq[]> => {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'faqs',
      depth: 0,
      draft: false,
      limit: 100,
      sort: 'sortOrder',
    })

    return result.docs
      .map((doc) => toPublicFaq(doc as CmsFaqDoc))
      .filter((faq): faq is PublicFaq => faq !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  },
  ['payload-public-faqs'],
  { revalidate: 300, tags: ['content-faqs'] },
)

export async function getPublishedFaqs(): Promise<PublicFaq[]> {
  if (!process.env.DATABASE_URI) {
    return FALLBACK_FAQS
  }

  try {
    const faqs = await readCachedFaqs()
    return faqs.length > 0 ? faqs : FALLBACK_FAQS
  } catch {
    return FALLBACK_FAQS
  }
}

function toPublicFaq(doc: CmsFaqDoc): PublicFaq | null {
  const question = doc.question?.trim()
  const slug = doc.slug?.trim()
  const answer = toPlainText(doc.answer).trim()

  if (!question || !slug || !answer) {
    return null
  }

  return {
    question,
    slug,
    category: doc.category ?? 'salary-tax',
    answer,
    sortOrder: doc.sortOrder ?? 0,
  }
}

function toPlainText(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return ''
  }

  try {
    return convertLexicalToPlaintext({
      data: value as Parameters<typeof convertLexicalToPlaintext>[0]['data'],
    })
  } catch {
    return ''
  }
}
