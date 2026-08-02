import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'admins',
  defaultSort: 'email',
  labels: {
    singular: '管理员',
    plural: '管理员',
  },
  auth: true,
  admin: {
    useAsTitle: 'email',
    group: '系统记录',
    defaultColumns: ['email', 'name', 'role'],
  },
  fields: [
    {
      name: 'name',
      label: '姓名',
      type: 'text',
    },
    {
      name: 'role',
      label: '角色',
      type: 'select',
      defaultValue: 'editor',
      options: [
        { label: '管理员', value: 'admin' },
        { label: '编辑', value: 'editor' },
      ],
      required: true,
    },
  ],
}
