'use client'

import { useCallback } from 'react'

type Notify = (message: string) => void

export default function useCityLocator(notify: Notify) {
  return useCallback(() => {
    if (!navigator.geolocation) {
      notify('当前浏览器不支持自动定位，请手动选择城市')
      return
    }

    notify('正在获取位置，请允许浏览器访问定位权限')
    navigator.geolocation.getCurrentPosition(
      () => notify('已获取位置，正式版将匹配对应城市规则'),
      () => notify('暂时无法获取位置，请手动选择城市'),
    )
  }, [notify])
}
