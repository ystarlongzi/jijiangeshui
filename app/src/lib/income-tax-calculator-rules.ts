import type {
  IncomeTaxIncomeType,
  IncomeTaxRateRule,
  IncomeTaxpayerIdentity,
  IncomeTaxYearRules,
} from './income-tax-rule-types'
import type { TaxBracket } from './tax-rules'

/**
 * 非工资计算器只接收当前年度的一条规则，避免客户端组件依赖 Payload 查询实现。
 * 规则缺失时由计算函数继续使用内置参数，并在界面显示提示。
 */
export type IncomeTaxCalculatorRuleProps = {
  taxRateRule?: IncomeTaxRateRule
  taxRateYear?: number
}

export function findIncomeTaxRateRule(
  yearRules: IncomeTaxYearRules | undefined,
  incomeType: IncomeTaxIncomeType,
  taxpayerIdentity: IncomeTaxpayerIdentity,
) {
  return yearRules?.taxRates.find((rule) => rule.incomeType === incomeType && rule.taxpayerIdentity === taxpayerIdentity)
}

/** 只有 CMS 返回了完整表格时才覆盖内置累进税率表。 */
export function getIncomeTaxTableBrackets(rule: IncomeTaxRateRule | undefined, fallback: TaxBracket[]) {
  return rule?.rateMode === 'table' && rule.brackets.length > 0 ? rule.brackets : fallback
}

/** 只有 CMS 返回了 0～100% 之间的比例税率时才覆盖内置比例税率。 */
export function getIncomeTaxFlatRate(rule: IncomeTaxRateRule | undefined, fallback = 0.2) {
  const rate = rule?.rateMode === 'flat' ? rule.flatRate : undefined
  return typeof rate === 'number' && Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : fallback
}

export function hasUsableIncomeTaxRule(rule: IncomeTaxRateRule | undefined, mode: IncomeTaxRateRule['rateMode']) {
  if (!rule || rule.rateMode !== mode) return false
  return mode === 'table'
    ? rule.brackets.length > 0
    : typeof rule.flatRate === 'number' && Number.isFinite(rule.flatRate) && rule.flatRate >= 0 && rule.flatRate <= 1
}

export function getIncomeTaxRuleWarning(
  rule: IncomeTaxRateRule | undefined,
  mode: IncomeTaxRateRule['rateMode'],
  year: number,
  label: string,
) {
  return hasUsableIncomeTaxRule(rule, mode)
    ? []
    : [`${year} 年${label}税率规则未读取到 CMS，当前使用内置参考值。`]
}
