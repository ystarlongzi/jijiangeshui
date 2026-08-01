import { z } from 'zod'

// 采集源可能来自不同网站或脚本版本，同一个字段有时是字符串，有时是数字。
// 这里先用宽松 schema 接住原始数据，具体业务兜底放在 import/validate 脚本里处理。
const idSchema = z.union([z.string(), z.number()])
const rawRecordSchema = z.record(z.string(), z.unknown())
const policySourceSchema = z
  .object({
    title: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    checkedAt: z.string().nullable().optional(),
    remark: z.string().nullable().optional(),
  })
  .passthrough()

export const crawlCitySchema = z
  .object({
    areaId: idSchema.optional(),
    areaName: z.string().optional(),
    shortName: z.string().optional(),
    areaCode: z.string().optional(),
    parentAreaId: idSchema.optional(),
    parentAreaName: z.string().optional(),
  })
  .passthrough()

export const crawlPolicySchema = z
  .object({
    areaId: idSchema.optional(),
    areaName: z.string().optional(),
    policyYear: idSchema.optional(),
    effectiveFrom: z.string().optional(),
    baseRulesInfo: z.object({ list: z.array(rawRecordSchema).optional() }).optional(),
    itemRulesInfo: z.object({ list: z.array(rawRecordSchema).optional() }).optional(),
    externalCodes: rawRecordSchema.optional(),
    source: policySourceSchema.optional(),
    status: z.string().optional(),
    errorMessage: z.string().nullable().optional(),
  })
  .passthrough()

export const wrappedPolicySchema = z.object({ policy: crawlPolicySchema }).passthrough()
// 兼容两种政策列表格式：
// 1. 直接返回 policy 对象
// 2. 返回 { policy, ...meta } 包裹对象
export const crawlPolicyEntrySchema = z.union([wrappedPolicySchema, crawlPolicySchema])

export const crawlResultSchema = z
  .object({
    cityInfo: z.object({ list: z.array(crawlCitySchema).optional() }).optional(),
    socialInsurancePolicy: z.object({ list: z.array(crawlPolicyEntrySchema).optional() }).optional(),
    crawlJob: z
      .object({
        source: z.string().optional(),
        status: z.string().optional(),
        triggerType: z.string().optional(),
        startedAt: z.string().optional(),
        finishedAt: z.string().optional(),
        errorMessage: z.string().nullable().optional(),
      })
      .optional(),
  })
  .passthrough()

export type CrawlCity = z.infer<typeof crawlCitySchema>
export type CrawlPolicy = z.infer<typeof crawlPolicySchema>
export type CrawlPolicyEntry = z.infer<typeof crawlPolicyEntrySchema>
export type WrappedPolicy = z.infer<typeof wrappedPolicySchema>
