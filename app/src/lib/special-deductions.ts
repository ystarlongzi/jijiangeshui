export type SpecialDeductionOption = {
  id: string
  label: string
  amount: number
}

export type SpecialDeductionItem = SpecialDeductionOption & {
  group: string
}

export type SpecialDeductionGroup = {
  key: string
  title: string
  note: string
  options: SpecialDeductionOption[]
}

export const specialDeductionGroups: SpecialDeductionGroup[] = [
  {
    key: 'children',
    title: '子女教育',
    note: '每个子女每月 2,000 元，可由一方全额扣除，也可夫妻各扣 50%。',
    options: [
      { id: 'children-1-full', label: '1 个子女，本人全额扣除', amount: 2000 },
      { id: 'children-1-half', label: '1 个子女，夫妻平分', amount: 1000 },
      { id: 'children-2-full', label: '2 个子女，本人全额扣除', amount: 4000 },
      { id: 'children-2-half', label: '2 个子女，夫妻平分', amount: 2000 },
    ],
  },
  {
    key: 'infant',
    title: '3 岁以下婴幼儿照护',
    note: '每个婴幼儿每月 2,000 元，可由一方全额扣除，也可夫妻各扣 50%。',
    options: [
      { id: 'infant-1-full', label: '1 个婴幼儿，本人全额扣除', amount: 2000 },
      { id: 'infant-1-half', label: '1 个婴幼儿，夫妻平分', amount: 1000 },
      { id: 'infant-2-full', label: '2 个婴幼儿，本人全额扣除', amount: 4000 },
      { id: 'infant-2-half', label: '2 个婴幼儿，夫妻平分', amount: 2000 },
    ],
  },
  {
    key: 'education',
    title: '继续教育',
    note: '包含学历继续教育，以及技能人员或专业技术人员职业资格继续教育。',
    options: [
      { id: 'education-degree', label: '学历继续教育', amount: 400 },
      { id: 'education-certificate', label: '职业资格继续教育，按全年摊算', amount: 300 },
    ],
  },
  {
    key: 'loan',
    title: '住房贷款利息',
    note: '首套住房贷款利息通常由夫妻一方扣除；婚前分别购房的特殊情况可各扣 50%。',
    options: [
      { id: 'loan-first-home-full', label: '首套住房贷款利息，本人全额扣除', amount: 1000 },
      { id: 'loan-before-marriage-half', label: '婚前各自首套房，夫妻各扣 50%', amount: 500 },
    ],
  },
  {
    key: 'rent',
    title: '住房租金',
    note: '主要工作城市无自有住房，且不能与住房贷款利息同时享受。',
    options: [
      { id: 'rent-1500', label: '直辖市、省会、计划单列市等', amount: 1500 },
      { id: 'rent-1100', label: '市辖区户籍人口超过 100 万', amount: 1100 },
      { id: 'rent-800', label: '市辖区户籍人口不超过 100 万', amount: 800 },
    ],
  },
  {
    key: 'elderly',
    title: '赡养老人',
    note: '独生子女每月 3,000 元；非独生子女需约定或指定分摊，个人最高每月 1,500 元。',
    options: [
      { id: 'elderly-only', label: '独生子女，本人全额扣除', amount: 3000 },
      { id: 'elderly-1-sibling', label: '非独生，有 1 个兄弟姐妹', amount: 1500 },
      { id: 'elderly-2-siblings', label: '非独生，有 2 个兄弟姐妹', amount: 1000 },
      { id: 'elderly-3-siblings', label: '非独生，有 3 个兄弟姐妹', amount: 750 },
    ],
  },
  {
    key: 'medical',
    title: '大病医疗',
    note: '年度汇算时据实扣除，暂不计入月度工资预扣反推。',
    options: [],
  },
]

export function createSpecialDeductionItems(groups: SpecialDeductionGroup[]): SpecialDeductionItem[] {
  return groups.flatMap((group) => group.options.map((option) => ({ ...option, group: group.title })))
}

export const specialDeductionItems = createSpecialDeductionItems(specialDeductionGroups)

export const sumSpecialDeductions = (selections: Record<string, string>, items: SpecialDeductionItem[] = specialDeductionItems) =>
  Object.values(selections).reduce((sum, id) => sum + (items.find((item) => item.id === id)?.amount || 0), 0)
