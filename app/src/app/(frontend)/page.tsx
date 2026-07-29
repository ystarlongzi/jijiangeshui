import Link from 'next/link'

export default function HomePage() {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '96px 24px', fontFamily: 'system-ui, sans-serif' }}>
      <p style={{ color: '#168c78', fontWeight: 700 }}>极简个税 · 工资薪金</p>
      <h1 style={{ fontSize: 'clamp(2.5rem, 8vw, 5rem)', lineHeight: 1.05, margin: '16px 0' }}>先看懂，再算清。</h1>
      <p style={{ color: '#52615e', fontSize: 20, maxWidth: 600 }}>
        选择城市，输入工资和社保公积金基数，查看本月到手与全年逐月明细。
      </p>
      <div style={{ display: 'flex', gap: 16, marginTop: 32 }}>
        <Link href="/calculator" style={{ color: '#fff', background: '#168c78', padding: '12px 20px', borderRadius: 8, textDecoration: 'none' }}>
          打开工资计算器
        </Link>
        <Link href="/admin" style={{ color: '#fff', background: '#168c78', padding: '12px 20px', borderRadius: 8, textDecoration: 'none' }}>
          打开内容后台
        </Link>
        <a href="/prototype/" style={{ color: '#163c37', border: '1px solid #b7c9c4', padding: '12px 20px', borderRadius: 8, textDecoration: 'none' }}>
          查看原型
        </a>
      </div>
    </main>
  )
}
