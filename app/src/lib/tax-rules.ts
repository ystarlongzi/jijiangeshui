export type CityRule = {
  name: string
  label: string
  socialMin: number
  socialMax: number
  housingMin: number
  housingMax: number
  effective: string
  socialEmployee: number
  socialEmployer: number
  medicalEmployee: number
  medicalEmployer: number
}

export const cityRules: Record<string, CityRule> = {
  beijing: { name: '北京', label: '北京市', socialMin: 6326, socialMax: 31884, housingMin: 2420, housingMax: 31884, effective: '2026-07-01', socialEmployee: 8, socialEmployer: 16, medicalEmployee: 2, medicalEmployer: 9.5 },
  shanghai: { name: '上海', label: '上海市', socialMin: 7460, socialMax: 37302, housingMin: 2690, housingMax: 37302, effective: '2026-07-01', socialEmployee: 8, socialEmployer: 16, medicalEmployee: 2, medicalEmployer: 9.5 },
  shenzhen: { name: '深圳', label: '深圳市', socialMin: 2520, socialMax: 38853, housingMin: 2360, housingMax: 38853, effective: '2026-07-01', socialEmployee: 8, socialEmployer: 14, medicalEmployee: 2, medicalEmployer: 5.5 },
  guangzhou: { name: '广州', label: '广州市', socialMin: 2300, socialMax: 38082, housingMin: 2300, housingMax: 39528, effective: '2026-07-01', socialEmployee: 8, socialEmployer: 14, medicalEmployee: 2, medicalEmployer: 6 },
  hangzhou: { name: '杭州', label: '杭州市', socialMin: 4986, socialMax: 25299, housingMin: 2490, housingMax: 39000, effective: '2026-01-01', socialEmployee: 8, socialEmployer: 16, medicalEmployee: 2, medicalEmployer: 9.5 },
}

export const housingRateOptions = [3, 5, 7, 8, 10, 12]

export const taxBrackets = [
  { ceiling: 36000, rate: 0.03, quick: 0 },
  { ceiling: 144000, rate: 0.1, quick: 2520 },
  { ceiling: 300000, rate: 0.2, quick: 16920 },
  { ceiling: 420000, rate: 0.25, quick: 31920 },
  { ceiling: 660000, rate: 0.3, quick: 52920 },
  { ceiling: 960000, rate: 0.35, quick: 85920 },
  { ceiling: Infinity, rate: 0.45, quick: 181920 },
]

export const deductionOptions = [
  { label: '子女教育', amount: 2000 },
  { label: '3 岁以下婴幼儿照护', amount: 2000 },
  { label: '住房租金', amount: 1500 },
  { label: '赡养老人', amount: 3000 },
]
