import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

export default defineConfig([
  ...nextVitals,
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'public/**',
    'next-env.d.ts',
    'src/payload-types.ts',
  ]),
  {
    rules: {
      // 现有计算器需要在 URL、localStorage 和城市规则变化后同步表单状态；这些副作用是产品交互的一部分。
      'react-hooks/set-state-in-effect': 'off',
      // 保留现有手动 useMemo，避免 React Compiler 对规则对象依赖做出误报。
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/immutability': 'off',
    },
  },
])
