import type { Component } from 'vue'
import type { DeviceQueryTerm } from './api/device'
import type { IotDevice } from './views/device/list/types'

export type UnifiedDevice = IotDevice & { category: string; channelNumber?: number; networkAddress?: string }
/** 各模块提供分类及详情/编辑入口，列表、分页和范围统计统一由宿主管理。 */
export interface DeviceListProvider {
  id: string
  label: () => string
  order: number
  menuCode: string
  terms: () => DeviceQueryTerm[]
  matches: (device: IotDevice) => boolean
  /** 新增弹窗遵循 open / update:open / saved，保存后由列表刷新数据和统计。 */
  create?: { label: () => string; component: Component }
  detailRoute?: string
  detailParam?: string
  detailComponent?: Component
  detailProps?: (device: UnifiedDevice) => Record<string, unknown>
  editComponent?: Component
  editRoute?: string
  batchComponent?: Component
  enrich?: (devices: UnifiedDevice[]) => Promise<UnifiedDevice[]>
  remove?: (device: UnifiedDevice) => Promise<unknown>
  canDelete?: (device: UnifiedDevice) => boolean
}
