import type { ContributionSource } from './tax-rules'

export type CityRuleConfig = {
  name: string
  label: string
  province: string
  pinyin: string
  socialMin: number
  socialMax: number
  housingMin: number
  housingMax: number
  effective: string
  socialEmployee: number
  socialEmployer: number
  medicalEmployee: number
  medicalEmployer: number
  sources?: ContributionSource[]
}

export const defaultHousingRateOptions = [3, 5, 7, 8, 10, 12]

export const fallbackCityRuleConfigs: Record<string, CityRuleConfig> = {
  beijing: {
    name: '北京',
    label: '北京市',
    province: '北京',
    pinyin: 'beijing',
    socialMin: 6326,
    socialMax: 31884,
    housingMin: 2420,
    housingMax: 31884,
    effective: '2026-07-01',
    socialEmployee: 8,
    socialEmployer: 16,
    medicalEmployee: 2,
    medicalEmployer: 9.5,
  },
  shanghai: {
    name: '上海',
    label: '上海市',
    province: '上海',
    pinyin: 'shanghai',
    socialMin: 7460,
    socialMax: 37302,
    housingMin: 2690,
    housingMax: 37302,
    effective: '2026-07-01',
    socialEmployee: 8,
    socialEmployer: 16,
    medicalEmployee: 2,
    medicalEmployer: 9.5,
  },
  shenzhen: {
    name: '深圳',
    label: '深圳市',
    province: '广东',
    pinyin: 'shenzhen',
    socialMin: 2520,
    socialMax: 38853,
    housingMin: 2360,
    housingMax: 38853,
    effective: '2026-07-01',
    socialEmployee: 8,
    socialEmployer: 14,
    medicalEmployee: 2,
    medicalEmployer: 5.5,
  },
  guangzhou: {
    name: '广州',
    label: '广州市',
    province: '广东',
    pinyin: 'guangzhou',
    socialMin: 2300,
    socialMax: 38082,
    housingMin: 2300,
    housingMax: 39528,
    effective: '2026-07-01',
    socialEmployee: 8,
    socialEmployer: 14,
    medicalEmployee: 2,
    medicalEmployer: 6,
  },
  hangzhou: {
    name: '杭州',
    label: '杭州市',
    province: '浙江',
    pinyin: 'hangzhou',
    socialMin: 4986,
    socialMax: 25299,
    housingMin: 2490,
    housingMax: 39000,
    effective: '2026-01-01',
    socialEmployee: 8,
    socialEmployer: 16,
    medicalEmployee: 2,
    medicalEmployer: 9.5,
  },
}
