import assert from 'node:assert/strict'
import test from 'node:test'

import { serializeJsonLd } from './JsonLd'

test('JSON-LD 序列化：转义可打断 script 标签的 CMS 文本', () => {
  const serialized = serializeJsonLd({
    '@context': 'https://schema.org',
    name: '</script><script>alert("xss")</script>',
    description: '规则 & 说明\u2028下一行',
  })

  assert.equal(serialized.includes('</script>'), false)
  assert.equal(serialized.includes('<script>'), false)
  assert.equal(serialized.includes('&'), false)
  assert.equal(serialized.includes('\u2028'), false)
  assert.match(serialized, /\\u003c\/script\\u003e/)
  assert.match(serialized, /\\u0026/)
  assert.match(serialized, /\\u2028/)
})
