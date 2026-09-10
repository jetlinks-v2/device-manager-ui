import type { Component } from 'vue'
import type { DeviceQueryTerm } from './api/device'
import type { IotDevice } from './views/device/list/types'

export type UnifiedDevice = IotDevice & { category: string; channelNumber?: number; networkAddress?: string }
export type DeviceCreateEntry = {
  label: () => string
  permission?: string
} & (
  | { component: Component; route?: never }
  | { route: string; params?: Record<string, string>; component?: never }
)
/** 各模块提供分类及详情/编辑入口，列表、分页和范围统计统一由宿主管理。 */
export interface DeviceListProvider {
  id: string
  label: () => string
  order: number
  menuCode: string
  terms: () => DeviceQueryTerm[]
  matches: (device: IotDevice) => boolean
  /** 弹窗遵循 open / update:open / saved；路由入口复用原新增页，返回时重载列表。 */
  create?: DeviceCreateEntry
  detailRoute?: string
  detailParam?: string
  detailComponent?: Component
  detailProps?: (device: UnifiedDevice) => Record<string, unknown>
  /** 保留统一详情头部，按真实设备替换下方内容；内容组件接收 deviceId 并管理自身页签。 */
  detailContent?: { component: Component; props?: (device: IotDevice) => Record<string, unknown> }
  editComponent?: Component
  editRoute?: string
  batchComponent?: Component
  enrich?: (devices: UnifiedDevice[]) => Promise<UnifiedDevice[]>
  remove?: (device: UnifiedDevice) => Promise<unknown>
  canDelete?: (device: UnifiedDevice) => boolean
}
