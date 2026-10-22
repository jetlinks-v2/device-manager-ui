import type { DashboardGridItem } from '@jetlinks-web-core/components/DashBoardCanvas'
import { kinds, type DeviceDetailKind } from '../shared'

export const detailLayoutMode = (width: number) => width > 0 && width < 560 ? 'compact' : width > 0 && width < 900 ? 'medium' : 'wide'

/** 默认布局只有内容坐标；拖动、缩放及个人缓存仍交给原画布。 */
export function buildDeviceDetailLayout(width: number): Array<{ kind: DeviceDetailKind; grid: DashboardGridItem }> {
  const mode = detailLayoutMode(width), compact = mode === 'compact', stacked = mode !== 'wide'
  const metricHeight = compact ? 7 : 5
  const metricRows = stacked ? metricHeight * 2 : metricHeight
  return kinds.map((kind, index) => {
    if (index < 4) return { kind, grid: { x: stacked ? index % 2 * 12 : index * 6,
      y: stacked ? Math.floor(index / 2) * metricHeight : 0, w: stacked ? 12 : 6, h: metricHeight, minW: 3, minH: 4 } }
    if (kind === 'MessageTrend') return { kind, grid: { x: 0, y: metricRows, w: 24, h: 11, minW: 6, minH: 8 } }
    return { kind, grid: { x: stacked ? 0 : (index - 5) * 12, y: metricRows + 11 + (stacked ? (index - 5) * 12 : 0), w: stacked ? 24 : 12, h: 12, minW: 6, minH: 8 } }
  })
}

