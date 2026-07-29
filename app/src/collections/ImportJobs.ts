import type { CollectionConfig } from 'payload'

export const ImportJobs: CollectionConfig = {
  slug: 'import-jobs',
  labels: {
    singular: '规则导入任务',
    plural: '规则导入任务',
  },
  admin: {
    useAsTitle: 'jobTitle',
    defaultColumns: ['jobTitle', 'source', 'status', 'createdAt'],
  },
  fields: [
    { name: 'jobTitle', label: '任务名称', type: 'text', required: true },
    { name: 'source', label: '数据来源', type: 'select', options: [{ label: 'Hrwork', value: 'hrwork' }, { label: '人工 JSON', value: 'manual' }], required: true },
    { name: 'status', label: '状态', type: 'select', options: [{ label: '运行中', value: 'running' }, { label: '成功', value: 'success' }, { label: '部分成功', value: 'partialSuccess' }, { label: '失败', value: 'failed' }], required: true },
    { name: 'triggerType', label: '触发方式', type: 'select', options: [{ label: '手动', value: 'manual' }, { label: '定时', value: 'scheduled' }, { label: '重试', value: 'retry' }], defaultValue: 'manual' },
    { name: 'startedAt', label: '开始时间', type: 'date' },
    { name: 'finishedAt', label: '结束时间', type: 'date' },
    { name: 'totalCities', label: '城市总数', type: 'number', min: 0 },
    { name: 'successCities', label: '成功城市数', type: 'number', min: 0 },
    { name: 'failedCities', label: '失败城市数', type: 'number', min: 0 },
    { name: 'sourceFile', label: '来源文件', type: 'text' },
    { name: 'warnings', label: '警告', type: 'json' },
    { name: 'errorMessage', label: '错误信息', type: 'textarea' },
  ],
}
