import dayjs from 'dayjs'
import type { TableColumnsType } from 'ant-design-vue'
import type { Component } from 'vue'
import type { UnifiedDevice } from '../../../../deviceListProvider'
import type { GatewayRuntimeMetricsMap } from '../../../../../edge-master-ui/views/workbench/gateway/hooks/useGatewayRuntimeMetricsLoader'
import type { DeviceDetailState } from './useUnifiedDeviceRows'

import type { DeviceScopeKind, DeviceScopeOption } from '../../../../components/deviceScopeTypes'
export type { DeviceScopeKind, DeviceScopeOption } from '../../../../components/deviceScopeTypes'

export interface UnifiedDeviceResultsModel {
  rows: UnifiedDevice[]
  total?: number
  selectedIds: string[]
  loading: boolean
  loadingMore: boolean
  error: string
  appendError: string
  hasMore: boolean
  hasSearch: boolean
  details: Record<string, DeviceDetailState>
  revision: number
  readingIndex: number
  readingOffset: number
  activeType: string
  showCategory: boolean
  categoryLabels: Record<string, string>
  showArea: boolean
  showChannel: boolean
  monitorCell?: Component
  monitorMetrics: GatewayRuntimeMetricsMap
  stateAction: { allowed: boolean; disabled: boolean }
  scopeEditor: {
    allowed: boolean; disabled: boolean; loading: boolean; error: string
    areas: DeviceScopeOption[]; groups: DeviceScopeOption[]
    save: (device: UnifiedDevice, kind: DeviceScopeKind, ids: string[]) => Promise<void>
  }
}
const present = (value?: string) => value?.trim() && !['--', '—'].includes(value.trim()) ? value.trim() : ''
export const deviceBrandModel = (row: UnifiedDevice) => [present(row.productManufacturer), present(row.productModel)].filter(Boolean).join(' · ')
export const deviceArea = (row: UnifiedDevice) => row.areaBindings?.map(item => item.area).filter(Boolean).join(' / ') || present(row.area)
export const deviceGroup = (row: UnifiedDevice) => row.groupBindings?.map(group => group.name).filter(Boolean).join('、') || present(row.groupName)
export const deviceScopeIds = (row: UnifiedDevice, kind: DeviceScopeKind): string[] => kind === 'group'
  ? row.groupBindings?.map(group => group.id).filter(Boolean) || []
  : row.areaBindings?.length ? row.areaBindings.flatMap(binding => binding.areaId ? [binding.areaId] : []) : row.areaId ? [row.areaId] : []
export const deviceTime = (value?: number | string | null, format = 'YYYY-MM-DD HH:mm:ss') => value && value !== '--' && dayjs(value).isValid() ? dayjs(value).format(format) : ''
export const deviceConnectionTime = (row: UnifiedDevice) => row.connectionStatus === 'online' ? row.onlineAt : row.connectionStatus === 'offline' ? row.offlineAt : undefined

export function deviceListColumns(model: UnifiedDeviceResultsModel, t: (key: string) => string, availableWidth = 0): TableColumnsType<UnifiedDevice> {
  const columns: TableColumnsType<UnifiedDevice> = [
    { title: t('UnifiedDeviceList.name'), key: 'name', width: 240, fixed: 'left' },
    { title: t('UnifiedDeviceList.status'), key: 'status', width: 184 },
  ]
  if (model.activeType === 'gateway' && model.monitorCell) columns.push({ title: t('GatewayDeviceCard.monitor'), key: 'monitor', width: 208 })
  const channel = ['gateway', 'video'].includes(model.activeType) && model.showChannel
  const baseWidth = columns.reduce((sum, column) => sum + Number(column.width || 0), 40) + 176 + 184 + (channel ? 88 : 0)
  const splitScope = model.showArea && availableWidth >= baseWidth + 104
  const splitProduct = availableWidth >= baseWidth + (splitScope ? 104 : 0) + 224
  columns.push({ title: t('UnifiedDeviceList.product'), key: 'product', width: 176 })
  if (splitProduct) columns.push({ title: t('UnifiedDeviceList.manufacturer'), key: 'manufacturer', width: 112 }, { title: t('UnifiedDeviceList.model'), key: 'model', width: 112 })
  if (splitScope) columns.push({ title: t('UnifiedDeviceList.area'), key: 'area', width: 144 }, { title: t('UnifiedDeviceList.group'), key: 'group', width: 144 })
  else columns.push({ title: t(model.showArea ? 'UnifiedDeviceList.areaAndGroup' : 'UnifiedDeviceList.group'), key: 'scope', width: 184 })
  if (channel) columns.push({ title: t('UnifiedDeviceList.channel'), key: 'channel', width: 88 })
  return columns
}
