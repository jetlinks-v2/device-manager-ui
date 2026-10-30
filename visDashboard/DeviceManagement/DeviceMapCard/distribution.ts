import echarts from '@jetlinks-web-core/components/Echarts/library'
import { GeoComponent } from 'echarts/components'
import type { DeviceMapPoint } from '../shared'
import land from './distributionLand.json'

// 用户原型的陆地轮廓，不含国界或设备样例；所有点位仍来自当前授权的定位接口。
const mapName = 'device-distribution-land'
echarts.use([GeoComponent])
echarts.registerMap(mapName, land as Parameters<typeof echarts.registerMap>[1])

export type DistributionState = 'online' | 'offline' | 'disabled' | 'unknown'
export type DistributionLabels = Record<DistributionState, string>
export const distributionColors: Record<DistributionState, string> = {
  online: '#00b42a', offline: '#f53f3f', disabled: '#a9aeb8', unknown: '#a9aeb8',
}

/** 禁用及未知不能冒充离线；状态比较使用接口枚举值。 */
export function distributionState(point: DeviceMapPoint): DistributionState {
  if (point.state === 'online' || point.state === 'offline') return point.state
  return point.state === 'notActive' || point.state === 'disabled' ? 'disabled' : 'unknown'
}

/** 与原型相同的墨卡托底图和独立设备圆点；离线点绘制在上层，不按区域计数。 */
export function buildDeviceDistributionOption(points: DeviceMapPoint[], labels: DistributionLabels, size = { width: 412, height: 300 }) {
  const radians = Math.PI / 180
  const mercatorY = (latitude: number) => -Math.log(Math.tan(Math.PI / 4 + latitude * radians / 2))
  const aspect = (135 - 73) * radians / (mercatorY(17) - mercatorY(54))
  return {
    animation: false,
    backgroundColor: '#f7faff',
    tooltip: { trigger: 'item', confine: true, renderMode: 'richText',
      formatter: (params: { data?: DeviceMapPoint }) => params.data
        ? `${params.data.label || params.data.deviceId}\n${params.data.stateText || labels[distributionState(params.data)]}` : '' },
    geo: {
      map: mapName, roam: false, silent: true,
      layoutCenter: ['50%', '50%'], layoutSize: Math.max(1, Math.min(size.width - 12, (size.height - 12) * aspect)),
      boundingCoords: [[73, 54], [135, 17]],
      projection: {
        project: ([lng, lat]: number[]) => [lng * radians, mercatorY(lat)],
        unproject: ([x, y]: number[]) => [x / radians, (2 * Math.atan(Math.exp(-y)) - Math.PI / 2) / radians],
      },
      itemStyle: { areaColor: '#e5e6eb', borderColor: '#c9cdd4', borderWidth: 0.6 },
      emphasis: { disabled: true },
    },
    series: [{ type: 'scatter', coordinateSystem: 'geo', symbolSize: 7,
      data: [...points].sort((a, b) => Number(a.state === 'offline') - Number(b.state === 'offline'))
        .map(point => ({ ...point, name: point.label, value: point.lnglat,
          itemStyle: { color: distributionColors[distributionState(point)], borderColor: '#fff', borderWidth: 1, opacity: 0.85 } })),
      emphasis: { scale: 1.5 },
    }],
  }
}
