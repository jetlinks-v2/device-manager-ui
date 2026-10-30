import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { DeviceQueryTerm } from './api/device'
import type { IotDevice } from './views/device/list/types'

export type UnifiedDevice = IotDevice & {
  category: string
  channelNumber?: number
  networkAddress?: string
  createdAt?: string
  lastReportTime?: number | null
}
export type DeviceCreateEntry = {
  label: () => string
  permission?: string
} & (
  | { component: Component; route?: never }
  | { route: string; params?: Record<string, string>; component?: never }
  | { drawer: DeviceCreateDrawerOptions; component?: never; route?: never }
)

/** 通用新增设备抽屉的受限产品来源；由分类 Provider 声明，设备模块负责实际渲染。 */
export type DeviceCreateDrawerOptions = {
  /** 产品接入方式白名单，会作为产品查询的固定条件，不能被页面筛选移除。 */
  accessProviders?: string[]
  /** 不探测或展示设备库，只允许从当前环境的产品创建。 */
  productOnly?: boolean
}
/** 各模块提供分类及详情/编辑入口，列表、分页和范围统计统一由宿主管理。 */
export interface DeviceListProvider {
  id: string
  label: () => string
  order: number
  menuCode: string
  /** 仅控制顶部分类页签；隐藏后仍参与设备识别和已有分类直达链接。 */
  showInTabs?: boolean
  terms: () => DeviceQueryTerm[]
  matches: (device: IotDevice) => boolean
  /** 弹窗遵循 open / update:open / saved；路由入口复用原新增页，返回时重载列表。 */
  create?: DeviceCreateEntry
  /** 列表引导宿主接收 active/request/projectId，发出 refresh；request 递增代表用户主动接入，忽略自动提示偏好。 */
  listGuide?: Component
  /** 详情是当前列表的子路由时，由 Provider 返回保留入口上下文的目标地址。 */
  detailPath?: (device: UnifiedDevice) => RouteLocationRaw
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

/** 物联设备范围排除边缘及视频接入，与概览物联统计使用同一产品查询契约。 */
export function getIotDeviceScopeTerms(): DeviceQueryTerm[] {
  const excluded = ['agent-device-gateway', 'agent-media-device-gateway', 'official-edge-gateway', 'fixed-media', 'gb28181-2016', 'media-plugin', 'onvif']
  return [{ column: 'productId$product-info', value: `accessProvider nin (${excluded.join(',')})` }]
}
