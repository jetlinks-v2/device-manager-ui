import type { Component } from 'vue'

/** 新旧设备详情共用的最小设备身份，不要求宿主转换各自的完整展示模型。 */
export interface DeviceDetailSubject {
  id: string
  accessProvider?: string
}

/**
 * 设备详情扩展页签，业务模块通过 moduleRegistry 的 deviceDetailTabs 资源注册。
 * matches 依据加载后的设备能力判断，不能依赖列表分类 query；props 由扩展模块适配自身组件。
 */
export interface DeviceDetailTabProvider {
  key: string
  label: () => string
  icon: string
  /** 需要对应业务菜单授权才显示；不指定时只根据设备能力判断。 */
  menuCode?: string
  order?: number
  matches: (device: DeviceDetailSubject) => boolean
  component: Component
  props?: (device: DeviceDetailSubject) => Record<string, unknown>
}
