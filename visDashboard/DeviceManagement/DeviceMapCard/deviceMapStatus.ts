import type { DeviceMapPoint } from '../shared'

export type DistributionState = 'online' | 'offline' | 'disabled' | 'unknown'

export const distributionColors: Record<DistributionState, string> = {
  online: '#00b42a', offline: '#f53f3f', disabled: '#a9aeb8', unknown: '#a9aeb8',
}

/** 禁用及未知不能冒充离线；状态比较使用接口枚举值。 */
export function distributionState(point: Pick<DeviceMapPoint, 'state'>): DistributionState {
  if (point.state === 'online' || point.state === 'offline') return point.state
  return point.state === 'notActive' || point.state === 'disabled' ? 'disabled' : 'unknown'
}
