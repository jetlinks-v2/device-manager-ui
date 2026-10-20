import type { DashboardStoredLayoutItem } from '@jetlinks-web-core/components/DashBoardCanvas'

export const infrastructureLayoutStorageKey = 'infrastructure-dashboard'
const realtimeId = 'systemMonitorRealtimeResources'
const trendRows = 13

/** 按舒展后的摘要行高分配空间：单节点8行、双节点11行，最多13行后在表内滚动。 */
export function buildInfrastructureLayout(nodeCount: number): DashboardStoredLayoutItem[] {
  const count = Number.isFinite(nodeCount) ? Math.max(1, Math.ceil(nodeCount)) : 1
  return layoutAtHeight(Math.min(13, 5 + count * 3))
}

function layoutAtHeight(height: number): DashboardStoredLayoutItem[] {
  return [
    { i: realtimeId, x: 0, y: 0, w: 12, h: height },
    { i: 'systemMonitorCpuTrend', x: 0, y: height, w: 6, h: trendRows },
    { i: 'systemMonitorMemoryTrend', x: 6, y: height, w: 6, h: trendRows },
    { i: 'systemMonitorNetworkTrend', x: 0, y: height + trendRows, w: 12, h: trendRows },
  ]
}

/** 仅调整完整默认布局；任意卡片被手工移动或缩放后，都保留该份个人坐标。 */
export function resizeDefaultInfrastructureLayout(saved: readonly DashboardStoredLayoutItem[], nodeCount: number): DashboardStoredLayoutItem[] | undefined {
  if (saved.length !== 4 || new Set(saved.map(item => item.i)).size !== 4) return
  const matches = (expected: DashboardStoredLayoutItem[]) => expected.every(item => saved.some(previous => (
    previous.i === item.i && previous.x === item.x && previous.y === item.y
    && previous.w === item.w && previous.h === item.h
  )))
  // 同时识别早期紧凑的7/9行与旧版固定13行默认布局，手工坐标不参与调整。
  if (![7, 8, 9, 11, 13].some(height => matches(layoutAtHeight(height)))) return
  const next = buildInfrastructureLayout(nodeCount)
  if (matches(next)) return
  return saved.map(item => ({ ...item, ...next.find(position => position.i === item.i)! }))
}
