import { ArrowRight } from 'lucide-react'
import TrackedLink from './TrackedLink'

type LongTailType = 'labor' | 'author' | 'license' | 'rental' | 'transfer' | 'business' | 'dividend' | 'accidental'

type RelatedLink = {
  label: string
  href: string
  note: string
}

type InfoItem = {
  title: string
  scope: string
  basis: string
  related: RelatedLink[]
  faq: { question: string; answer: string }[]
}

const infoMap: Record<LongTailType, InfoItem> = {
  labor: {
    title: '劳务报酬适用范围',
    scope: '适合独立设计、咨询、讲课、翻译、技术服务等非雇佣性质收入的单次或单月预扣测算。',
    basis: '居民个人劳务报酬先扣除费用，再按预扣率表计算预扣税额；年度汇算时通常并入综合所得。',
    related: [
      { label: '稿酬计算器', href: '/author-tax', note: '作品出版、发表收入' },
      { label: '特许权使用费计算器', href: '/license-tax', note: '专利、著作权使用权收入' },
      { label: '税率表', href: '/tax-rate', note: '查看综合所得预扣规则' },
    ],
    faq: [
      { question: '劳务报酬和工资薪金有什么区别？', answer: '工资薪金通常来自任职受雇关系；劳务报酬通常来自独立提供劳务。两者在预扣方式上不同，年度汇算时居民个人劳务报酬通常并入综合所得。' },
      { question: '为什么不超过 4000 元和超过 4000 元算法不同？', answer: '劳务报酬预扣时先扣除费用：每次收入不超过 4000 元的，按 800 元扣除；超过 4000 元的，按收入 20% 扣除。' },
      { question: '这里算的是最终个税吗？', answer: '不是最终汇算结果。这里估算的是劳务报酬取得当次的预扣税额，年度综合所得汇算时还可能补税或退税。' },
    ],
  },
  author: {
    title: '稿酬适用范围',
    scope: '适合作品出版、发表取得稿酬收入时，估算当次预扣税额和税后到手。',
    basis: '稿酬所得先扣除费用，再按收入额减按 70% 计算，并通常按 20% 比例预扣。',
    related: [
      { label: '劳务报酬计算器', href: '/labor-tax', note: '独立劳务收入预扣' },
      { label: '特许权使用费计算器', href: '/license-tax', note: '使用权许可收入' },
      { label: '税率表', href: '/tax-rate', note: '查看稿酬预扣口径' },
    ],
    faq: [
      { question: '稿酬为什么还要减按 70%？', answer: '稿酬所得在扣除费用后，收入额按 70% 计算应纳税所得额，因此同样税前收入下，稿酬预扣通常低于普通劳务报酬。' },
      { question: '稿酬会并入综合所得吗？', answer: '居民个人取得稿酬所得，年度汇算时通常并入综合所得；本页结果是取得当次的预扣估算。' },
      { question: '稿费、版税都能用这个页面吗？', answer: '作品出版、发表取得的稿酬收入适合用本页；如果是转让或许可著作权使用权产生的收入，可能更接近特许权使用费。' },
    ],
  },
  license: {
    title: '特许权使用费适用范围',
    scope: '适合专利、商标、著作权、非专利技术等使用权收入的预扣测算。',
    basis: '居民个人特许权使用费先扣除费用，再通常按 20% 比例预扣；年度汇算时通常并入综合所得。',
    related: [
      { label: '稿酬计算器', href: '/author-tax', note: '作品出版、发表收入' },
      { label: '劳务报酬计算器', href: '/labor-tax', note: '独立服务收入' },
      { label: '税率表', href: '/tax-rate', note: '查看综合所得规则' },
    ],
    faq: [
      { question: '特许权使用费和稿酬有什么区别？', answer: '稿酬通常来自作品出版、发表；特许权使用费通常来自专利、商标、著作权等使用权许可。特许权使用费不适用稿酬减按 70% 的口径。' },
      { question: '这里为什么没有 70% 减按？', answer: '70% 减按是稿酬所得的口径，特许权使用费通常按扣除费用后的余额计算预扣税额。' },
      { question: '最终还要年度汇算吗？', answer: '居民个人取得特许权使用费，年度汇算时通常并入综合所得；本页只估算当次预扣。' },
    ],
  },
  rental: {
    title: '财产租赁适用范围',
    scope: '适合个人出租房屋、设备或其他财产，按月估算租赁所得个税。',
    basis: '财产租赁所得通常以一个月内取得的收入为一次，扣除可扣税费、修缮费和法定费用后计算个税。',
    related: [
      { label: '财产转让计算器', href: '/property-transfer-tax', note: '出售房屋、股权等财产' },
      { label: '利息股息红利计算器', href: '/dividend-tax', note: '分红和利息收入' },
      { label: '税率表', href: '/tax-rate', note: '查看分类所得税率' },
    ],
    faq: [
      { question: '出租住房为什么可以选 10%？', answer: '个人出租住房常见口径可按 10% 优惠税率估算；其他财产租赁通常按 20% 比例税率估算。实际仍以当地税务口径为准。' },
      { question: '修缮费用可以全部扣除吗？', answer: '修缮费用通常每次最多扣除 800 元；一次扣不完的部分，可能延续到以后月份扣除。' },
      { question: '转租支付的租金能扣吗？', answer: '本页提供转租租金输入，用于估算先扣相关成本后的应纳税所得额；正式申报时需要结合凭证和当地口径核对。' },
    ],
  },
  transfer: {
    title: '财产转让适用范围',
    scope: '适合转让房屋、股权或其他财产时，按转让收入、财产原值和合理费用做通用测算。',
    basis: '财产转让所得通常以收入额减除财产原值和合理费用后的余额为应纳税所得额，再按 20% 计算。',
    related: [
      { label: '财产租赁计算器', href: '/rental-tax', note: '出租房屋或设备收入' },
      { label: '经营所得计算器', href: '/business-tax', note: '个体经营年度收入' },
      { label: '税率表', href: '/tax-rate', note: '查看分类所得税率' },
    ],
    faq: [
      { question: '财产原值填什么？', answer: '一般填取得该财产时的成本或原始购置价值，具体凭证口径需要按财产类型和税务要求确认。' },
      { question: '合理费用包括哪些？', answer: '合理费用通常指转让过程中按规定可扣除的税费和相关费用。不同财产类型要求不同，本页只做通用估算。' },
      { question: '亏损转让还要交个税吗？', answer: '如果收入减原值和合理费用后不产生正的应纳税所得额，本页按 0 计算个税。' },
    ],
  },
  business: {
    title: '经营所得适用范围',
    scope: '适合个体工商户、个人独资企业投资人、合伙企业个人合伙人等做年度经营所得粗算。',
    basis: '经营所得通常按年度收入总额减除成本、费用及损失后的余额，再套用 5% 至 35% 五级超额累进税率。',
    related: [
      { label: '财产转让计算器', href: '/property-transfer-tax', note: '转让财产收入' },
      { label: '劳务报酬计算器', href: '/labor-tax', note: '非雇佣服务收入' },
      { label: '税率表', href: '/tax-rate', note: '查看经营所得税率' },
    ],
    faq: [
      { question: '经营所得是按月还是按年算？', answer: '经营所得通常按纳税年度计算。本页按年度口径估算，和工资薪金的月度累计预扣不是同一套表。' },
      { question: '成本费用填什么？', answer: '可以填经营过程中与收入相关的成本、费用支出。查账征收、核定征收等口径可能不同，正式申报需以账册和税务口径为准。' },
      { question: '经营亏损怎么处理？', answer: '本页支持输入经营损失并参与扣除；如果扣除后应纳税所得额不为正，个税按 0 估算。' },
    ],
  },
  dividend: {
    title: '利息股息红利适用范围',
    scope: '适合利息、股息、红利所得按次估算个税和税后收入。',
    basis: '利息、股息、红利所得通常不并入综合所得，按每次收入额和 20% 比例税率计算。',
    related: [
      { label: '偶然所得计算器', href: '/accidental-tax', note: '中奖、得奖等收入' },
      { label: '财产租赁计算器', href: '/rental-tax', note: '出租财产收入' },
      { label: '税率表', href: '/tax-rate', note: '查看分类所得税率' },
    ],
    faq: [
      { question: '分红收入会并入工资一起算吗？', answer: '通常不并入综合所得，而是按利息、股息、红利所得分类计税。' },
      { question: '所有利息收入都要按 20% 吗？', answer: '不同金融产品可能有免税或特殊政策。本页只按通用 20% 比例税率做估算。' },
      { question: '税后收入怎么理解？', answer: '税后收入等于本次税前收入减去按 20% 估算的个人所得税。' },
    ],
  },
  accidental: {
    title: '偶然所得适用范围',
    scope: '适合中奖、得奖、中彩等偶然取得收入时，估算个税和税后收入。',
    basis: '偶然所得通常以每次收入额为应纳税所得额，按 20% 比例税率计算个人所得税。',
    related: [
      { label: '利息股息红利计算器', href: '/dividend-tax', note: '分红、利息收入' },
      { label: '财产转让计算器', href: '/property-transfer-tax', note: '出售财产收入' },
      { label: '税率表', href: '/tax-rate', note: '查看分类所得税率' },
    ],
    faq: [
      { question: '偶然所得可以扣除费用吗？', answer: '通用口径下，偶然所得通常不扣除费用，直接以每次收入额计算应纳税额。' },
      { question: '中奖收入是按到手还是税前算？', answer: '本页输入税前收入，结果会估算应缴个税和税后收入。' },
      { question: '偶然所得会并入年度综合所得吗？', answer: '通常不并入综合所得，而是按偶然所得分类计税。' },
    ],
  },
}

export default function LongTailInfo({ type }: { type: LongTailType }) {
  const info = infoMap[type]

  return <section className="longtail-info-section">
    <div className="longtail-info-grid">
      <article>
        <span>适用范围</span>
        <h2>{info.title}</h2>
        <p>{info.scope}</p>
      </article>
      <article>
        <span>计算口径</span>
        <h2>本页怎么估算？</h2>
        <p>{info.basis}</p>
      </article>
    </div>
    <div className="longtail-related">
      <div>
        <span>相关工具</span>
        <h2>还可以继续算什么？</h2>
      </div>
      <div className="longtail-related-links">
        {info.related.map((item) => <TrackedLink key={item.href} href={item.href} eventPayload={{ module: 'longtail_related', label: item.label, source: type }}>
          <strong>{item.label}</strong>
          <small>{item.note}</small>
          <ArrowRight size={15} />
        </TrackedLink>)}
      </div>
    </div>
    <div className="longtail-faq">
      <h2>常见问题</h2>
      <div className="faq-list">
        {info.faq.map((item) => <details key={item.question}>
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
        </details>)}
      </div>
    </div>
  </section>
}
