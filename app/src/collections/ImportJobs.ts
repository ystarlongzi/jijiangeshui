import type { CollectionConfig } from 'payload'

export const ImportJobs: CollectionConfig = {
  slug: 'import-jobs',
  defaultSort: '-createdAt',
  labels: {
    singular: '规则导入任务',
    plural: '规则导入任务',
  },
  admin: {
    useAsTitle: 'jobTitle',
    group: '系统记录',
    defaultColumns: ['jobTitle', 'source', 'status', 'successCities', 'failedCities', 'createdAt'],
    listSearchableFields: ['jobTitle', 'sourceFile', 'errorMessage'],
    description: '记录社保公积金规则采集、校验、导入和发布流水线结果。',
  },
  fields: [
    { name: 'jobTitle', label: '任务名称', type: 'text', required: true, admin: { description: '建议包含来源、年份和批次，例如 Hrwork 2026 全量导入。' } },
    {
      name: 'source',
      label: '数据来源',
      type: 'select',
      options: [
        { label: '内置兜底规则', value: 'fallback' },
        { label: '人工 JSON', value: 'manual' },
        { label: '官方核验', value: 'official' },
        { label: 'Hrwork', value: 'hrwork' },
      ],
      required: true,
    },
    { name: 'status', label: '状态', type: 'select', options: [{ label: '运行中', value: 'running' }, { label: '成功', value: 'success' }, { label: '部分成功', value: 'partialSuccess' }, { label: '失败', value: 'failed' }], required: true },
    { name: 'triggerType', label: '触发方式', type: 'select', options: [{ label: '手动', value: 'manual' }, { label: '定时', value: 'scheduled' }, { label: '重试', value: 'retry' }], defaultValue: 'manual' },
    { name: 'startedAt', label: '开始时间', type: 'date' },
    { name: 'finishedAt', label: '结束时间', type: 'date' },
    { name: 'totalCities', label: '城市总数', type: 'number', min: 0 },
    { name: 'successCities', label: '成功城市数', type: 'number', min: 0 },
    { name: 'failedCities', label: '失败城市数', type: 'number', min: 0 },
    { name: 'sourceFile', label: '来源文件', type: 'text', admin: { description: '导入时使用的 JSON 文件路径或来源标识。' } },
    { name: 'warnings', label: '警告', type: 'json', admin: { description: '保留校验阶段的非阻断问题。' } },
    { name: 'errorMessage', label: '错误信息', type: 'textarea' },
  ],
}
