# 社保、公积金与企业用工成本规则需求文档

## 1. 背景

系统需要维护不同城市、不同时期的社保、公积金及企业用工成本规则，用于后续计算个人缴费、单位缴费、到手工资、个税和企业用工成本。

本功能只负责存储和查询“规则怎么计算”，不负责存储每次计算后的结果。

例如第三方接口返回中的这些字段属于计算结果，不进入规则表：

```json
{
  "empFee": 524.96,
  "orgFee": 1223.15,
  "totalFee": 1748.11,
  "empProp": "4952 x 8%"
}
```

规则表只需要能表达：

```text
养老保险：个人 = 社保基数 x 8%，单位 = 社保基数 x 16%
大病医疗保险：个人 = 固定 5 元，单位 = 不缴
公积金：个人 = 公积金基数 x 5%，单位 = 公积金基数 x 5%
残疾人就业保障金：个人 = 不缴，单位 = 固定金额或公式计算
```

## 2. 设计目标

1. 支持不同城市的规则配置。
2. 支持历年规则，不覆盖历史数据。
3. 支持社保基数和公积金基数分别配置。
4. 支持每个缴费项目分别配置个人和单位的缴费方式。
5. 支持比例、固定金额、不缴、比例加固定金额。
6. 支持单位侧用工成本项目，例如残疾人就业保障金。
7. 支持前端根据结构化规则拼接展示文案，例如 `4952 x 8%`、`固定金额`、`-`。
8. 不在规则表中存储计算结果。
9. 暂不考虑复杂舍入规则，计算金额默认四舍五入到 2 位小数。
10. 暂不考虑优惠、减免、补差、原始金额和最终金额差异。

## 3. 核心概念

### 3.1 政策版本

同一个城市的规则会随时间变化，因此需要政策版本。

政策变更时，不修改旧记录，而是新增一版规则，并用生效日期区分。

示例：

| 城市 | 规则类型 | 基数上限 | 生效开始 | 生效结束 |
| --- | --- | ---: | --- | --- |
| 上海 | 社保 | 36921 | 2025-07-01 | 2026-06-30 |
| 上海 | 社保 | 38370 | 2026-07-01 | 2027-06-30 |

计算 2026 年 5 月工资时命中第一条，计算 2026 年 8 月工资时命中第二条。

### 3.2 基数规则

社保和公积金的缴费基数范围可能不同，需要分开存储。

示例：

```text
社保基数：下限 4952，上限 27862
公积金基数：下限 4952，上限 40694
```

### 3.3 项目规则

养老、医疗、失业、工伤、生育、大病医疗、公积金、残疾人就业保障金等项目的个人和单位缴费规则不同，需要按项目存储。

个人和单位要分别配置缴费方式，因为同一个项目可能出现：

```text
工伤保险：个人不缴，单位按比例缴
大病医疗：个人固定金额，单位不缴
养老保险：个人按比例缴，单位按比例缴
残疾人就业保障金：个人不缴，单位按固定金额或公式缴
```

说明：残疾人就业保障金不是社保险种，也不是员工个人工资扣款，但它是企业用户需要关心的单位用工成本。因此它应纳入单位侧规则和展示范围，只是在归类上属于 `employerCost`，不属于 `social`。

## 4. 数据模型

### 4.1 City

城市基础表。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 主键 |
| areaId | string | 是 | Hrwork 区域 id，对应 getArea 返回的 areaId |
| parentAreaId | string | 否 | Hrwork 父级区域 id，对应 getArea 返回的 parentAreaId |
| provinceAreaId | string | 否 | Hrwork 省级区域 id，对应 getArea 返回的 provinceAreaId |
| areaCode | string | 否 | Hrwork 城市拼音编码，例如 hangzhou |
| shortName | string | 否 | 城市简称或缩写 |
| code | string | 否 | 本系统城市编码，可后续映射行政区划码 |
| name | string | 是 | 城市名称，例如 杭州市 |
| provinceCode | string | 否 | 省份编码 |
| provinceName | string | 否 | 省份名称 |
| level | enum/string | 否 | province / city / district |
| parentCode | string | 否 | 上级行政区划码 |
| enabled | boolean | 是 | 是否启用 |
| createdAt | DateTime | 是 | 创建时间 |
| updatedAt | DateTime | 是 | 更新时间 |

说明：

```text
City 是系统基础字典，不使用 SocialInsurance 前缀。
由于当前社保/公积金数据源依赖 Hrwork 的 getArea 接口，City 直接保存 areaId、parentAreaId、provinceAreaId、areaCode、shortName，便于爬虫和前端计算时匹配城市。
```

### 4.2 SocialInsurancePolicy

城市政策版本表。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 主键 |
| cityId | string | 是 | 关联 City |
| policyYear | int | 否 | 政策年度，例如 2026 |
| effectiveFrom | DateTime | 是 | 生效开始日期 |
| effectiveTo | DateTime | 否 | 生效结束日期，空表示当前仍有效 |
| sourceUrl | string | 否 | 政策来源链接 |
| sourceTitle | string | 否 | 政策来源标题 |
| status | enum | 是 | draft / active / archived |
| remark | string | 否 | 备注 |
| createdAt | DateTime | 是 | 创建时间 |
| updatedAt | DateTime | 是 | 更新时间 |

约束建议：

```text
同一城市 active 政策的 effectiveFrom/effectiveTo 不应重叠。
```

### 4.3 SocialInsuranceBaseRule

缴费基数规则表。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 主键 |
| policyId | string | 是 | 关联 SocialInsurancePolicy |
| baseType | enum | 是 | social / housingFund |
| baseMin | decimal | 是 | 缴费基数下限 |
| baseMax | decimal | 是 | 缴费基数上限 |
| remark | string | 否 | 备注 |
| createdAt | DateTime | 是 | 创建时间 |
| updatedAt | DateTime | 是 | 更新时间 |

说明：

```text
social 表示社保基数。
housingFund 表示公积金基数。
```

### 4.4 SocialInsuranceItemRule

缴费项目规则表。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 主键 |
| policyId | string | 是 | 关联 SocialInsurancePolicy |
| baseRuleId | string | 否 | 关联 SocialInsuranceBaseRule。固定金额项目可为空 |
| systemType | enum | 是 | social / housingFund / employerCost |
| itemCode | enum/string | 是 | 项目编码 |
| itemName | string | 是 | 项目名称 |
| employeeCalcMethod | enum | 是 | none / rate / fixed / ratePlusFixed |
| employeeRate | decimal | 否 | 个人缴费比例，例如 0.08 |
| employeeFixedAmount | decimal | 否 | 个人固定金额 |
| employerCalcMethod | enum | 是 | none / rate / fixed / ratePlusFixed |
| employerRate | decimal | 否 | 单位缴费比例，例如 0.16 |
| employerFixedAmount | decimal | 否 | 单位固定金额 |
| sortOrder | int | 是 | 展示排序 |
| remark | string | 否 | 备注 |
| createdAt | DateTime | 是 | 创建时间 |
| updatedAt | DateTime | 是 | 更新时间 |

常见 itemCode：

```text
pension          养老保险
medical          医疗保险
majorMedical     大病医疗保险 / 大额医疗费用补助
unemployment     失业保险
injury           工伤保险
maternity        生育保险
housingFund      公积金
supplementInjury 补充工伤保险
disabledEmploymentSecurityFund 残疾人就业保障金
```

如果担心不同城市出现更多项目，`itemCode` 可以使用 string，而不是 Prisma enum。

## 5. Prisma Schema 建议

```prisma
enum CityLevel {
  province
  city
  district
}

enum SocialInsurancePolicyStatus {
  draft
  active
  archived
}

enum SocialInsuranceSystemType {
  social
  housingFund
  employerCost
}

enum SocialInsuranceBaseType {
  social
  housingFund
}

enum SocialInsuranceCalcMethod {
  none
  rate
  fixed
  ratePlusFixed
}

enum SocialInsuranceCrawlJobStatus {
  pending
  running
  success
  partialSuccess
  failed
}

enum SocialInsuranceCrawlCityStatus {
  pending
  running
  success
  parseFailed
  requestFailed
  skipped
}

enum SocialInsuranceCrawlRequestStatus {
  success[类型.ts](../%E7%B1%BB%E5%9E%8B.ts)
  failed
}

model City {
  id             String                  @id @default(cuid())
  areaId         String                  @unique
  parentAreaId   String?
  provinceAreaId String?
  areaCode       String?
  shortName      String?
  code           String?                 @unique
  name           String
  provinceCode   String?
  provinceName   String?
  level          CityLevel?
  parentCode     String?
  enabled        Boolean                 @default(true)
  createdAt      DateTime                @default(now())
  updatedAt      DateTime                @updatedAt

  socialInsurancePolicies SocialInsurancePolicy[]
  externalSocialInsuranceCities ExternalSocialInsuranceCity[]
  socialInsuranceCrawlCityResults SocialInsuranceCrawlCityResult[]

  @@index([parentAreaId])
  @@index([provinceAreaId])
  @@index([areaCode])
  @@index([provinceCode])
  @@index([parentCode])
}

model SocialInsurancePolicy {
  id            String                       @id @default(cuid())
  cityId        String
  policyYear    Int?
  effectiveFrom DateTime
  effectiveTo   DateTime?
  sourceUrl     String?
  sourceTitle   String?
  status        SocialInsurancePolicyStatus @default(draft)
  remark        String?
  createdAt     DateTime                     @default(now())
  updatedAt     DateTime                     @updatedAt

  city          City                         @relation(fields: [cityId], references: [id])
  baseRules     SocialInsuranceBaseRule[]
  itemRules     SocialInsuranceItemRule[]
  crawlCityResults SocialInsuranceCrawlCityResult[]

  @@index([cityId, status, effectiveFrom, effectiveTo])
  @@index([cityId, policyYear])
}

model SocialInsuranceBaseRule {
  id        String                  @id @default(cuid())
  policyId  String
  baseType  SocialInsuranceBaseType
  baseMin   Decimal                 @db.Decimal(12, 2)
  baseMax   Decimal                 @db.Decimal(12, 2)
  remark    String?
  createdAt DateTime                @default(now())
  updatedAt DateTime                @updatedAt

  policy    SocialInsurancePolicy   @relation(fields: [policyId], references: [id], onDelete: Cascade)
  itemRules SocialInsuranceItemRule[]

  @@unique([policyId, baseType])
  @@index([policyId])
}

model SocialInsuranceItemRule {
  id                    String                    @id @default(cuid())
  policyId              String
  baseRuleId            String?
  systemType            SocialInsuranceSystemType
  itemCode              String
  itemName              String

  employeeCalcMethod    SocialInsuranceCalcMethod
  employeeRate          Decimal?                  @db.Decimal(8, 6)
  employeeFixedAmount   Decimal?                  @db.Decimal(12, 2)

  employerCalcMethod    SocialInsuranceCalcMethod
  employerRate          Decimal?                  @db.Decimal(8, 6)
  employerFixedAmount   Decimal?                  @db.Decimal(12, 2)

  sortOrder             Int                       @default(0)
  remark                String?
  createdAt             DateTime                  @default(now())
  updatedAt             DateTime                  @updatedAt

  policy                SocialInsurancePolicy    @relation(fields: [policyId], references: [id], onDelete: Cascade)
  baseRule              SocialInsuranceBaseRule? @relation(fields: [baseRuleId], references: [id])

  @@unique([policyId, itemCode])
  @@index([policyId, systemType])
  @@index([baseRuleId])
}

model ExternalSocialInsuranceCity {
  id               String   @id @default(cuid())
  source           String
  cityId           String?
  externalAreaId   String
  externalAreaCode String?
  externalAreaName String
  rawData          Json?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  city             City?    @relation(fields: [cityId], references: [id])

  @@unique([source, externalAreaId])
  @@index([cityId])
}

model SocialInsuranceCrawlJob {
  id             String                        @id @default(cuid())
  source         String
  status         SocialInsuranceCrawlJobStatus @default(pending)
  triggerType    String?
  startedAt      DateTime?
  finishedAt     DateTime?
  totalCities    Int                           @default(0)
  successCities  Int                           @default(0)
  failedCities   Int                           @default(0)
  skippedCities  Int                           @default(0)
  errorMessage   String?
  createdAt      DateTime                      @default(now())
  updatedAt      DateTime                      @updatedAt

  cityResults    SocialInsuranceCrawlCityResult[]
  requestLogs    SocialInsuranceCrawlRequestLog[]

  @@index([source, status, createdAt])
}

model SocialInsuranceCrawlCityResult {
  id               String                         @id @default(cuid())
  jobId            String
  cityId           String?
  policyId         String?
  externalAreaId   String
  externalAreaCode String?
  externalAreaName String
  status           SocialInsuranceCrawlCityStatus @default(pending)
  errorMessage     String?
  startedAt        DateTime?
  finishedAt       DateTime?
  createdAt        DateTime                       @default(now())
  updatedAt        DateTime                       @updatedAt

  job              SocialInsuranceCrawlJob        @relation(fields: [jobId], references: [id], onDelete: Cascade)
  city             City?                          @relation(fields: [cityId], references: [id])
  policy           SocialInsurancePolicy?         @relation(fields: [policyId], references: [id])
  requestLogs      SocialInsuranceCrawlRequestLog[]

  @@index([jobId, status])
  @@index([cityId])
  @@index([policyId])
}

model SocialInsuranceCrawlRequestLog {
  id             String                            @id @default(cuid())
  jobId          String
  cityResultId   String?
  source         String
  endpoint       String
  requestPayload Json?
  responseStatus Int?
  responseSizeBytes Int?
  responseSummary Json?
  status         SocialInsuranceCrawlRequestStatus
  errorMessage   String?
  durationMs     Int?
  requestedAt    DateTime                          @default(now())

  job            SocialInsuranceCrawlJob           @relation(fields: [jobId], references: [id], onDelete: Cascade)
  cityResult     SocialInsuranceCrawlCityResult?   @relation(fields: [cityResultId], references: [id], onDelete: Cascade)

  @@index([jobId, endpoint])
  @@index([cityResultId])
  @@index([requestedAt])
}
```

## 6. 计算规则

### 6.1 基数处理

调用方传入用户实际基数：

```text
socialBaseInput
housingFundBaseInput
```

计算前先按对应基数规则限制范围：

```text
actualBase = min(max(inputBase, baseMin), baseMax)
```

### 6.2 项目金额计算

个人金额：

```text
none:
  0

rate:
  actualBase x employeeRate

fixed:
  employeeFixedAmount

ratePlusFixed:
  actualBase x employeeRate + employeeFixedAmount
```

单位金额同理，使用 `employerCalcMethod`、`employerRate`、`employerFixedAmount`。

金额默认四舍五入到 2 位小数。

残疾人就业保障金如果当前只需要支持单位侧固定金额或手动配置金额，可以使用：

```text
systemType = employerCost
itemCode = disabledEmploymentSecurityFund
employeeCalcMethod = none
employerCalcMethod = fixed
employerFixedAmount = 固定金额
```

如果后续需要按完整政策公式自动计算，再扩展公式类型或单独的公式规则表。

### 6.3 前端展示文案

前端可以根据规则生成展示文案：

```text
none:
  "-"

rate:
  "{actualBase} x {ratePercent}%"

fixed:
  "固定金额"

ratePlusFixed:
  "{actualBase} x {ratePercent}% + {fixedAmount}"
```

示例：

```text
employeeCalcMethod = rate
employeeRate = 0.08
actualBase = 4952
展示为：4952 x 8%

employeeCalcMethod = fixed
employeeFixedAmount = 5
展示为：固定金额

employerCalcMethod = none
展示为：-
```

### 6.4 薪资月份如何选择缴费基数

前端计算某个月社保、公积金费用时，要区分两类数据：

```text
1. 城市政策规则：某个工资月份适用哪一版上下限和比例。
2. 员工个人基数：该员工当期申报的社保基数、公积金基数。
```

计算顺序：

```text
1. 根据 cityCode + salaryMonth 命中 SocialInsurancePolicy。
2. 根据 policy 找到 social / housingFund 的 baseMin、baseMax。
3. 根据员工入职、年度申报、调基记录，确定员工当期申报基数。
4. 将员工申报基数限制在当期上下限之间。
5. 用限制后的 actualBase 计算各项目金额。
```

公式：

```text
actualBase = min(max(employeeDeclaredBase, baseMin), baseMax)
```

以北京为例，社保和公积金常见年度都是从 7 月开始，到次年 6 月结束。新入职员工和老员工跨年度调基的基数来源不同：

```text
新入职员工：通常用首月工资或入职申报工资作为当年度初始缴费基数。
老员工跨年度调基：通常用上一自然年度在本单位的月平均工资作为新年度缴费基数。
```

示例：员工 2025-01-01 入职北京新公司，计算 2025-01-01 到 2026-12-31 的工资。

| 工资月份 | 员工社保基数来源 | 社保上下限年度 | 员工公积金基数来源 | 公积金上下限年度 |
| --- | --- | --- | --- | --- |
| 2025-01 ~ 2025-06 | 新入职首月工资 / 入职申报工资 | 2024 社保年度 | 开户或调入时申报工资 | 2024 公积金年度 |
| 2025-07 ~ 2026-06 | 2025 年度申报基数；若上一年度不在本单位，通常沿用新入职/已申报工资口径 | 2025 社保年度 | 2025-2026 公积金年度申报基数 | 2025 公积金年度 |
| 2026-07 ~ 2026-12 | 2025 自然年度在本单位月平均工资 | 2026 社保年度 | 2025 自然年度在本单位月平均工资 | 2026 公积金年度 |

因此前端不能只按“当前工资”计算社保公积金，而要有员工基数历史：

```text
EmployeeSocialInsuranceBaseHistory
- employeeId
- cityId
- baseType              social / housingFund
- declaredBase
- effectiveFrom
- effectiveTo
- sourceType            onboarding / annualDeclaration / manualAdjustment
- remark
```

计算某个月工资时：

```text
policy = findPolicy(cityId, salaryMonth)
employeeBase = findEmployeeBase(employeeId, baseType, salaryMonth)
baseRule = policy.baseRules[baseType]
actualBase = clamp(employeeBase.declaredBase, baseRule.baseMin, baseRule.baseMax)
```

注意：

```text
SocialInsurancePolicy 解决“城市这段时间的规则是什么”。
EmployeeSocialInsuranceBaseHistory 解决“这个员工这段时间申报的基数是多少”。
```

如果只存城市政策，不存员工基数历史，就无法准确重算历史月份工资。

## 7. 示例规则数据

以下示例可表达用户提供的第三方接口规则。

### 7.1 基数规则

```json
[
  {
    "baseType": "social",
    "baseMin": 4952,
    "baseMax": 27862
  },
  {
    "baseType": "housingFund",
    "baseMin": 4952,
    "baseMax": 40694
  }
]
```

### 7.2 项目规则

```json
[
  {
    "systemType": "social",
    "itemCode": "pension",
    "itemName": "养老保险",
    "baseType": "social",
    "employeeCalcMethod": "rate",
    "employeeRate": 0.08,
    "employerCalcMethod": "rate",
    "employerRate": 0.16,
    "sortOrder": 10
  },
  {
    "systemType": "social",
    "itemCode": "medical",
    "itemName": "医疗保险",
    "baseType": "social",
    "employeeCalcMethod": "rate",
    "employeeRate": 0.02,
    "employerCalcMethod": "rate",
    "employerRate": 0.07,
    "sortOrder": 20
  },
  {
    "systemType": "social",
    "itemCode": "majorMedical",
    "itemName": "大病医疗保险",
    "baseType": null,
    "employeeCalcMethod": "fixed",
    "employeeFixedAmount": 5,
    "employerCalcMethod": "none",
    "sortOrder": 30
  },
  {
    "systemType": "social",
    "itemCode": "unemployment",
    "itemName": "失业保险",
    "baseType": "social",
    "employeeCalcMethod": "rate",
    "employeeRate": 0.005,
    "employerCalcMethod": "rate",
    "employerRate": 0.005,
    "sortOrder": 40
  },
  {
    "systemType": "social",
    "itemCode": "injury",
    "itemName": "工伤保险",
    "baseType": "social",
    "employeeCalcMethod": "none",
    "employerCalcMethod": "rate",
    "employerRate": 0.004,
    "sortOrder": 50
  },
  {
    "systemType": "social",
    "itemCode": "maternity",
    "itemName": "生育保险",
    "baseType": "social",
    "employeeCalcMethod": "none",
    "employerCalcMethod": "rate",
    "employerRate": 0.008,
    "sortOrder": 60
  },
  {
    "systemType": "housingFund",
    "itemCode": "housingFund",
    "itemName": "公积金",
    "baseType": "housingFund",
    "employeeCalcMethod": "rate",
    "employeeRate": 0.05,
    "employerCalcMethod": "rate",
    "employerRate": 0.05,
    "sortOrder": 10
  },
  {
    "systemType": "employerCost",
    "itemCode": "disabledEmploymentSecurityFund",
    "itemName": "残疾人就业保障金",
    "baseType": null,
    "employeeCalcMethod": "none",
    "employerCalcMethod": "fixed",
    "employerFixedAmount": 0,
    "sortOrder": 100
  }
]
```

## 8. Payload CMS 数据模型与应用接口

规则后台和个税前端统一放在 Next.js + Payload CMS 应用中，使用独立 PostgreSQL 数据库。Payload Collection 自动提供管理界面、REST API、GraphQL API 和 Local API；规则导入脚本优先通过 Local API 写入草稿。

### 8.1 Collections

| Collection | 主要职责 |
| --- | --- |
| `cities` | 城市名称、URL 标识、第三方 areaId、行政层级和城市 SEO 字段 |
| `social-insurance-policies` | 政策年度、生效时间、来源、基数范围、缴费项目和规则状态 |
| `articles` | 个税知识、城市政策和计算案例 |
| `faqs` | 常见问题和答案 |
| `import-jobs` | 规则导入任务、失败城市和解析警告 |

### 8.2 政策字段

`social-insurance-policies` 使用 Payload 的版本和草稿能力，同时保留业务上的政策字段：

```text
policyTitle
city
policyYear
effectiveFrom
effectiveTo
policyStatus: pendingReview / active / archived
source.title
source.url
source.checkedAt
baseRules[]
itemRules[]
warnings[]
rawData
```

Payload 的版本记录用于审计和恢复，`effectiveFrom`、`effectiveTo` 和 `policyStatus` 用于计算时选择真正适用的政策。两者不能互相替代。

### 8.3 前端查询

服务端计算逻辑通过 Payload Local API 查询某城市某月份的有效政策：

```text
city.slug = 城市标识
policyStatus = active
effectiveFrom <= 月份第一天
effectiveTo 为空或 effectiveTo >= 月份第一天
```

用户侧只读取 `active` 规则；待审核、草稿、解析失败规则不能进入计算结果。

### 8.4 导入流程

```text
Hrwork 采集脚本 / 人工 JSON
        ↓
normalize + validate
        ↓
Payload Local API
        ↓
pendingReview 草稿
        ↓
后台人工核对
        ↓
active
```

导入脚本需要支持幂等更新：同一城市、政策年度和生效日期重复导入时更新原草稿，不创建重复政策。任何解析警告都必须保留在 `warnings` 中，并阻止自动发布。

## 9. 校验规则

### 9.1 政策版本校验

1. `effectiveFrom` 必填。
2. `effectiveTo` 如果存在，必须大于等于 `effectiveFrom`。
3. 同一个城市的 active 政策时间区间不允许重叠。

### 9.2 基数规则校验

1. 同一个政策下，`social` 基数最多一条。
2. 同一个政策下，`housingFund` 基数最多一条。
3. `baseMin` 必须大于等于 0。
4. `baseMax` 必须大于等于 `baseMin`。

### 9.3 项目规则校验

1. 同一个政策下，`itemCode` 不重复。
2. `rate` 类型必须填写对应 rate。
3. `fixed` 类型必须填写对应 fixedAmount。
4. `ratePlusFixed` 类型必须填写对应 rate 和 fixedAmount。
5. `none` 类型下对应 rate 和 fixedAmount 应为空或按 0 处理。
6. 如果任一方缴费方式包含 `rate`，则必须关联 `baseRuleId`。
7. 固定金额项目可以不关联基数规则。

## 10. 当前不做的范围

1. 不保存每次计算结果。
2. 不保存第三方接口中的 `empFee`、`orgFee`、`totalFee`。
3. 不保存展示文案 `empProp`、`orgProp`，由前端或计算接口根据规则生成。
4. P0 固定金额计算和展示均按产品统一舍入规则执行，暂不支持后台自定义舍入策略。
5. 不处理优惠、减免、补差、手动调整。
6. 暂不处理残疾人就业保障金的完整政策公式；当前支持作为单位侧固定金额或手动配置金额项目。
7. 不处理工伤行业分类费率。如果后续需要，可新增行业费率表。

## 11. 后续可扩展项

### 11.1 工伤行业费率

如果需要支持同一城市不同行业工伤比例不同，可新增：

```text
SocialInsuranceIndustryRateRule
- id
- policyId
- itemCode
- industryCode
- industryName
- employerRate
```

### 11.2 残疾人就业保障金

残疾人就业保障金不是社保险种，通常也不是员工个人工资扣款，但它属于企业用户关心的单位用工成本。因此本模块需要支持它作为单位侧项目出现：

```text
systemType = employerCost
employeeCalcMethod = none
employerCalcMethod = fixed
```

如果后续需要按政策公式自动计算，可新增：

```text
SocialInsuranceFormulaRule
- id
- policyId
- itemCode
- formulaCode
- formulaParams
- remark
```

或者在 `SocialInsuranceCalcMethod` 中增加：

```text
formula
```

### 11.3 税前扣除归类

当前模块只返回个人缴费和单位缴费规则。个税模块可以按项目类型判断哪些个人缴费进入税前扣除。

如果后续希望规则中心直接提供归类，可在 `SocialInsuranceItemRule` 增加：

```text
employeeTaxDeductible Boolean
```

但当前版本先不需要。

## 12. 第三方数据采集方案

### 12.1 采集目标

通过第三方开放接口采集城市、社保方案、公积金方案和项目缴费规则，并转换为本系统的规则模型。

采集流程：

```text
1. 获取城市列表
2. 根据城市 id 获取该城市的社保、公积金参保方案
3. 根据城市、社保方案、公积金方案和基数调用计算接口
4. 从计算结果明细中解析项目规则
5. 转换为 SocialInsurancePolicy / SocialInsuranceBaseRule / SocialInsuranceItemRule
```

注意：第三方接口返回的 `empFee`、`orgFee`、`totalFee` 仍然只作为解析和校验规则的中间数据，不直接进入规则表。

### 12.2 接口 1：获取城市列表

接口：

```http
POST https://gw.hrwork.com/pcommon-service/shebao/open/getArea
```

请求体为空。

用途：

```text
获取可采集城市列表，包括城市 id、城市名称、城市编码等。
```

需要提取的字段：

| 字段 | 说明 |
| --- | --- |
| areaId | 第三方城市 id，用于后续查询 |
| areaName | 城市名称，例如 杭州市 |
| areaCode | 城市编码，例如 hangzhou |

建议落库或缓存为采集源城市映射：

```text
ExternalSocialInsuranceCity
- id
- source              hrwork
- cityId              关联 City，可为空，等待人工映射
- externalAreaId
- externalAreaCode
- externalAreaName
- rawData             可选，只保存当前城市这一条映射源数据，不保存完整 getArea 响应
- createdAt
- updatedAt
```

### 12.3 接口 2：获取城市社保和公积金方案

接口：

```http
POST https://gw.hrwork.com/pcommon-service/shebao/open/getInsOrg
```

请求体示例：

```json
{
  "areaId": 19,
  "loginFlag": 0
}
```

用途：

```text
根据城市 id 获取该城市可用的社保方案和公积金方案。
```

需要重点提取：

| 字段 | 说明 |
| --- | --- |
| sbCode | 社保方案编码 |
| sbTypeText | 社保方案名称，例如 杭州市社保 |
| sbBaseMin | 社保基数下限，如接口返回 |
| sbBaseMax | 社保基数上限，如接口返回 |
| gjjCode | 公积金方案编码 |
| gjjTypeText | 公积金方案名称，例如 杭州市公积金（单位5% + 个人5%） |
| gjjBaseMin | 公积金基数下限，如接口返回 |
| gjjBaseMax | 公积金基数上限，如接口返回 |

`getInsOrg` 响应中的 `response.data.shebao` 和 `response.data.gjj` 最后一项，是基数范围和外部方案编码的来源。

基数范围提取规则：

```text
社保基数范围：优先取 response.data.shebao 数组最后一项。
公积金基数范围：优先取 response.data.gjj 数组最后一项。
```

外部方案编码提取规则：

```text
社保 externalPlanCode：取 response.data.shebao[idx].code，其中 idx 为最后一项下标。
公积金 externalPlanCode：取 response.data.gjj[idx].code，其中 idx 为最后一项下标。
```

calculator 入参提取规则：

```text
sbFlag 固定为 1。
gjjFlag 固定为 1。
sbCode 取 response.data.shebao[idx].code。
sbBase 取 response.data.shebao[idx].base。
gjjCode 取 response.data.gjj[idx].code。
gjjBase 取 response.data.gjj[idx].base。
```

如果最后一项字段名不稳定，解析器可以从最后一项中的数字兜底取最小值和最大值；无法确认时标记为待人工确认。

建议中间表：

```text
ExternalSocialInsurancePlan
- id
- source              hrwork
- externalAreaId
- externalAreaCode
- externalAreaName
- planType            social / housingFund
- externalPlanCode
- externalPlanName
- baseMin
- baseMax
- calculatorCode
- calculatorBase
- rawData             可选，只保存当前方案这一条源数据，不保存完整 getInsOrg 响应
- createdAt
- updatedAt
```

### 12.4 接口 3：调用计算器获取规则明细

接口：

```http
POST https://gw.hrwork.com/pcommon-service/shebao/open/calculator
```

请求体示例：

```json
{
  "areaName": "杭州市",
  "areaCode": "hangzhou",
  "areaId": 19,
  "sbFlag": 1,
  "sbCode": "JVBDUA",
  "sbBase": 4986,
  "gjjFlag": 1,
  "gjjCode": "4535S1_5",
  "gjjBase": 2660,
  "loginFlag": 0
}
```

用途：

```text
第三方接口返回社保和公积金的计算明细。
从 calcDetails 中解析每个项目的个人缴费方式、单位缴费方式、比例、固定金额。
```

返回中需要解析的位置：

```text
data.shebao.calcDetails[]
data.gjj.calcDetails[]
```

明细示例：

```json
{
  "itemName": "养老保险",
  "empProp": "4952 x 8%",
  "orgProp": "4952 x 16%",
  "empFee": 396.16,
  "orgFee": 792.32
}
```

### 12.5 规则解析

从 `empProp`、`orgProp` 解析缴费方式。

解析规则：

| 原始文本 | calcMethod | rate | fixedAmount |
| --- | --- | ---: | ---: |
| `-` | none | null | null |
| `4952 x 8%` | rate | 0.08 | null |
| `固定金额` | fixed | null | 使用对应 empFee/orgFee |
| `4952 x 2% + 5` | ratePlusFixed | 0.02 | 5 |

如果遇到无法解析的表达式：

```text
1. 保存原始响应。
2. 该城市/方案标记为 parseFailed。
3. 不自动发布为 active。
4. 进入人工确认列表。
```

项目名称到 itemCode 的建议映射：

| itemName 包含 | itemCode | systemType |
| --- | --- | --- |
| 养老 | pension | social |
| 医疗 | medical | social |
| 大病 / 大额 | majorMedical | social |
| 失业 | unemployment | social |
| 工伤 | injury | social |
| 生育 | maternity | social |
| 公积金 | housingFund | housingFund |
| 补充工伤 | supplementInjury | social |
| 残疾人 / 残保金 / 保障金 | disabledEmploymentSecurityFund | employerCost |

### 12.6 基数采集策略

优先级：

```text
1. 社保基数范围优先取 getInsOrg 响应中的 response.data.shebao 最后一项。
2. 公积金基数范围优先取 getInsOrg 响应中的 response.data.gjj 最后一项。
3. 外部方案编码取 response.data.shebao[idx].code / response.data.gjj[idx].code，其中 idx 为最后一项下标。
4. calculator 的 sbFlag / gjjFlag 固定传 1。
5. calculator 的 sbCode / gjjCode 取 response.data.shebao[idx].code / response.data.gjj[idx].code。
6. calculator 的 sbBase / gjjBase 取 response.data.shebao[idx].base / response.data.gjj[idx].base。
7. 如果最后一项字段名变化，可以从最后一项中的数字兜底解析最小值和最大值。
8. 如果 getInsOrg 只返回默认基数，则默认基数不能直接等同于上下限。
9. 如果 calculator 只返回某个传入基数下的计算结果，则它只能用于解析比例和固定金额，不能单独证明基数上下限。
10. 基数上下限无法自动确认时，生成 draft 政策，等待人工补齐。
```

calculator 请求中的 `sbBase` / `gjjBase` 用于触发规则明细计算，不单独作为政策上下限依据；政策上下限仍以 getInsOrg 最后一项解析出的基数范围为准。

### 12.7 转换为系统规则

采集完成后创建或更新：

```text
SocialInsurancePolicy
SocialInsuranceBaseRule
SocialInsuranceItemRule
```

转换示例：

```text
第三方：
itemName = 养老保险
empProp = 4952 x 8%
orgProp = 4952 x 16%

系统：
systemType = social
itemCode = pension
itemName = 养老保险
employeeCalcMethod = rate
employeeRate = 0.08
employerCalcMethod = rate
employerRate = 0.16
baseRuleId = socialBaseRule.id
```

```text
第三方：
itemName = 大病医疗保险
empProp = 固定金额
empFee = 5
orgProp = -

系统：
systemType = social
itemCode = majorMedical
employeeCalcMethod = fixed
employeeFixedAmount = 5
employerCalcMethod = none
baseRuleId = null
```

### 12.8 采集任务状态

建议增加三类采集记录，便于排查、重试和人工审核。

```text
SocialInsuranceCrawlJob
```

表示一次完整采集任务。例如“手动采集全部城市”或“定时采集杭州”。

```text
- id
- source              hrwork
- status              pending / running / success / partialSuccess / failed
- triggerType         manual / scheduled / retry
- startedAt
- finishedAt
- totalCities
- successCities
- failedCities
- skippedCities
- errorMessage
- createdAt
- updatedAt
```

```text
SocialInsuranceCrawlCityResult
```

表示一次任务中某个城市的采集结果。

```text
- id
- jobId
- cityId              关联 City，可为空
- policyId            成功导入后关联 SocialInsurancePolicy，可为空
- externalAreaId
- externalAreaCode
- externalAreaName
- status              pending / success / parseFailed / requestFailed / skipped
- errorMessage
- startedAt
- finishedAt
- createdAt
- updatedAt
```

`SocialInsuranceCrawlCityResult` 不保存 `rawAreaData`、`rawPlanData`、`rawCalculatorData`。这些响应体通常很大，而且与规则导入本身重复；城市级结果只负责记录“哪个城市采集成功/失败、关联到哪个政策、失败原因是什么”。

```text
SocialInsuranceCrawlRequestLog
```

表示采集过程中的每一次第三方接口请求，方便定位是 `getArea`、`getInsOrg` 还是 `calculator` 失败。

```text
- id
- jobId
- cityResultId        可为空，例如 getArea 是全局请求
- source              hrwork
- endpoint            getArea / getInsOrg / calculator
- requestPayload
- responseStatus
- responseSizeBytes   响应体字节数，用于排查异常大响应
- responseSummary     小摘要，例如第三方 code/message、data 顶层 key、列表数量
- status              success / failed
- errorMessage
- durationMs
- requestedAt
```

`SocialInsuranceCrawlRequestLog` 不保存完整 `responseBody`。如果确实需要保留原始响应，建议只在本地调试文件或对象存储里短期保存，并设置过期清理；数据库里默认只保存摘要，避免日志表快速膨胀。

状态判断建议：

```text
全部城市成功：job.status = success
部分城市成功：job.status = partialSuccess
全部失败或关键入口失败：job.status = failed
单个城市接口失败：cityResult.status = requestFailed
接口成功但规则无法解析：cityResult.status = parseFailed
城市未映射或暂不支持：cityResult.status = skipped
```

每次爬虫开始时创建 `SocialInsuranceCrawlJob`，每处理一个城市创建或更新 `SocialInsuranceCrawlCityResult`，每调用一次第三方接口追加一条 `SocialInsuranceCrawlRequestLog`。

### 12.9 NestJS 模块建议

模块划分：

```text
SocialInsuranceRulesModule
- 规则查询、规则管理、政策版本管理

SocialInsuranceCrawlerModule
- 第三方接口请求
- 城市列表采集
- 方案采集
- calculator 调用
- 规则解析和转换

SocialInsuranceParserService
- empProp/orgProp 解析
- itemName 到 itemCode 映射
- 第三方响应到内部 DTO 转换
```

建议服务：

```text
HrworkSocialInsuranceClient
- getAreas()
- getInsOrg(areaId)
- calculate(payload)

SocialInsuranceCrawlerService
- crawlAllCities()
- crawlCity(area)
- importCityRules(parsedRules)

SocialInsuranceRuleParserService
- parseCalcProp(propText, fee)
- mapItemName(itemName)
- parseCalculatorResponse(response)
```

### 12.10 请求注意事项

1. 请求头保留 `origin`、`referer`、`content-type`、`user-agent`。
2. 设置超时，例如 10 秒。
3. 设置并发限制，例如 3 到 5 个城市并发，避免请求过快。
4. 对 429、5xx、网络错误做重试，例如最多 3 次。
5. 不保存成功请求的完整原始响应；失败时可在脚本结果或本地调试文件中保留失败响应，方便排查。
6. 第三方数据导入后默认进入 `draft`，人工确认后再改为 `active`。
7. 使用第三方接口前需要确认其使用条款和数据授权，避免违反服务限制。

### 12.11 浏览器控制台兜底脚本

如果后台爬虫被限制，可以在浏览器控制台手动运行纯 JS 脚本：

```text
scripts/hrwork-social-insurance-console-crawler.js
```

运行方式：

```js
const result = await crawlAllHrworkSocialInsuranceRules();
```

只采集指定城市：

```js
const result = await crawlHrworkSocialInsuranceRules({
  cityFilter: "杭州"
});
```

常用参数：

```js
{
  limit: 3,                 // 限制采集城市数量，空表示全部
  cityFilter: "杭州",        // 按城市名称、areaCode、areaId 过滤
  concurrency: 3,           // 并发城市数
  delayMs: 250,             // 每个城市请求之间的等待时间，单位毫秒
  policyYear: "2026",       // 政策年度
  download: true,           // 采集完成后自动下载 JSON
  triggerType: "manual"     // 触发方式
}
```

返回结构：

```text
result.options
result.cityInfo.list
result.cityInfo.crawlJob
result.socialInsurancePolicy.list
result.crawlJob
result.requestLogs
```

其中 `cityInfo.list` 来自 `/shebao/open/getArea`，用于导入或映射城市；`socialInsurancePolicy.list` 是按城市整理后的社保/公积金规则采集结果；`requestLogs` 记录请求日志，成功请求不保存完整 `responseBody`，失败请求可以保留失败响应用于排查。

脚本响应类型：

```ts
interface CrawlerOptions {
  limit?: number | null;
  cityFilter?: string | ((city: CrawlCity) => boolean) | null;
  concurrency?: number;
  delayMs?: number;
  policyYear?: string;
  effectiveFrom?: string;
  download?: boolean;
  triggerType?: string;
}

// 通过接口 /shebao/open/getArea 抓取
interface CrawlCity {
  areaId: string; // 区域 id
  areaName: string; // 区域名称
  shortName: string; // 名称缩写
  areaCode: string; // 名称拼音
  parentAreaId?: string;
  parentAreaName?: string;
}

interface CrawlJob {
  endpoint?: "getArea" | "getInsOrg" | "calculator" | "all";
  startedAt: string;
  finishedAt: string;
  status: string; // 爬取状态
  triggerType: string; // 触发方式：手动、自动
  durationMs: number; // 耗时
  errorMessage?: string;
}

interface CrawlErrorResponse {
  status: string; // http 响应码
  message: string; // 错误消息
  responseBody?: any; // 仅失败时记录
}

// 通过接口 /shebao/open/getInsOrg 抓取
interface CrawlSocialInsuranceBaseRule {
  baseType: SocialInsuranceBaseType;
  baseMin: number;
  baseMax: number;
  // 社保、公积金都是取对应数组的最后一项
  // 示例：{ alias: "杭州市公积金（单位12% + 个人12%）", code: "4535S1_12", maxBase: 42151, minBase: 2660 }
  rawData: any;
}

// 通过接口 /shebao/open/calculator 抓取
interface CrawlSocialInsuranceItemRule {
  systemType: SocialInsuranceSystemType;
  itemCode: string;
  itemName: string;

  employeeCalcMethod: SocialInsuranceCalcMethod;
  employeeRate?: number;
  employeeFixedAmount?: number;

  employerCalcMethod: SocialInsuranceCalcMethod;
  employerRate?: number;
  employerFixedAmount?: number;

  // 社保、公积金取 calcDetails 中当前项目对应的那一项
  // 示例：{ empFee: 319, empProp: "2660 x 12%", itemName: "公积金", orgFee: 319, orgProp: "2660 x 12%", totalFee: 638 }
  rawData: any;
}

interface CrawlRequestLog {
  endpoint: "getArea" | "getInsOrg" | "calculator";
  startedAt: string;
  finishedAt: string;
  status: string;
  durationMs: number;
  requestPayload?: any;
  errorResponse?: CrawlErrorResponse; // 仅失败时记录
}

interface CrawlSocialInsurancePolicy {
  areaId: string;
  areaName: string; // 方便查看城市
  policyYear: string;
  effectiveFrom: string;

  baseRulesInfo: {
    list: CrawlSocialInsuranceBaseRule[];
    crawlJob: CrawlJob & {
      endpoint: "getInsOrg";
      errorResponse?: CrawlErrorResponse;
    };
  };

  itemRulesInfo: {
    list: CrawlSocialInsuranceItemRule[];
    crawlJob: CrawlJob & {
      endpoint: "calculator";
      errorResponse?: CrawlErrorResponse;
    };
  };
}

interface Result {
  options: CrawlerOptions; // 本次实际使用的采集参数

  cityInfo: {
    list: CrawlCity[];
    crawlJob: CrawlJob & {
      endpoint: "getArea";
    };
  };

  socialInsurancePolicy: {
    list: CrawlSocialInsurancePolicy[];
  };

  // 总的抓取信息汇总
  crawlJob: CrawlJob & {
    endpoint: "all";
  };

  // 抓取请求记录；成功请求不记录 responseBody，失败请求可在 errorResponse.responseBody 中记录
  requestLogs: CrawlRequestLog[];
}
```

这里相对草稿做了几个必要调整：

1. 全量采集会返回多个城市，所以 `socialInsurancePolicy` 使用 `{ list: CrawlSocialInsurancePolicy[] }`。
2. `itemRulesInfo.list` 是 `CrawlSocialInsuranceItemRule[]`，因为 calculator 会返回多个缴费项目。
3. 单个 `CrawlSocialInsuranceItemRule.rawData` 保存当前项目对应的 `calcDetails` 元素，不保存整个 `calcDetails` 数组，避免重复膨胀。
4. `requestLogs` 只在失败时记录 `errorResponse.responseBody`；成功请求不保存完整响应体。

基数上下限无法确认时，脚本会将 `baseMin/baseMax` 置为 `null`，并把对应城市或政策标记为 `parseFailed`，避免把默认基数误当作政策基数上下限。

目标页接口没有明确提供政策生效日期时，脚本默认将 `effectiveFrom` 设置为 `policyYear` 当年的 1 月 1 日，例如 `2026-01-01`。后续导入后台时再按规则生成政策状态，例如先进入 `draft`，人工确认后发布为 `active`。
