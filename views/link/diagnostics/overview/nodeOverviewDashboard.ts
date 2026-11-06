import { defineAsyncComponent, markRaw } from 'vue'
import type { DashboardCatalog, DashboardValue } from '@jetlinks-web-core/components/DashBoardCanvas'

export const nodeOverviewGroups = ['device', 'buffer', 'resources'] as const
export type NodeOverviewGroup = typeof nodeOverviewGroups[number]
export const nodeOverviewSummaryMetrics = ['messages', 'backlog', 'cpu', 'heap'] as const
export type NodeSummaryMetric = typeof nodeOverviewSummaryMetrics[number]
export type NodeOverviewLayout = 'narrow' | 'compact' | 'regular' | 'wide'

/** 以内容区而非屏幕宽度分档，侧栏和弹层变化同样能触发自动布局。 */
export function nodeOverviewLayout(width: number): NodeOverviewLayout { return width > 0 && width < 560 ? 'narrow' : width > 0 && width < 768 ? 'compact' : width >= 1200 ? 'wide' : 'regular' }

/** 摘要身份固定，布局存储只包含坐标，不把采样或能力状态写入配置。 */
export function nodeOverviewSummaryMetric(id: string): NodeSummaryMetric | undefined {
  return nodeOverviewSummaryMetrics.find(metric => id === `summary-${metric}`)
}

/** 与紧凑图的容器断点一致；预留标题和辅助读数，每行至少 188px，拖高才增加已有图表。 */
export function nodeResourceChartCapacity(width: number, height: number): number {
  const columns = width >= 544 ? 2 : 1
  return Math.max(2, Math.floor(Math.max(0, height - 82 + 12) / 188) * columns)
}

/** 注册只读业务组件；采集由节点页拥有，画布仅保存位置和尺寸。 */
export function nodeOverviewCatalog(t: (key: string) => string): DashboardCatalog {
  const components = {
    device: defineAsyncComponent(() => import('../NodeOperationalSignals.vue')),
    buffer: defineAsyncComponent(() => import('@jetlinks-web-core/components/RuntimeDiagnostics/RuntimeMBeanOverview.vue')),
    resources: defineAsyncComponent(() => import('@jetlinks-web-core/components/RuntimeDiagnostics/RuntimeMetricsPanel.vue')),
    summary: defineAsyncComponent(() => import('./NodeRuntimeSummary.vue')),
  }
  return markRaw({ groups: [{ id: 'node-overview', name: t('runtimeDiagnostics.overview') }], components: Object.fromEntries(Object.entries(components).map(([type, component]) => [type, {
    component: markRaw(component), configs: [], groupId: 'node-overview', defaultConfig: { type, componentProps: {} },
  }])) })
}

/** 宽窄屏使用独立布局；至少留出两张图、组标题和辅助读数的空间。 */
export function nodeOverviewDashboard(mode: NodeOverviewLayout, available: readonly NodeOverviewGroup[], expanded = false): DashboardValue {
  const narrow = mode === 'narrow', wide = mode === 'wide'
  const heights = narrow ? { device: 30, buffer: 28, resources: 32 } : { device: 17, buffer: 15, resources: 17 }
  if (wide) heights.buffer = heights.device
  if (expanded) heights.resources = narrow ? 78 : 48
  const summaryColumns = narrow || mode === 'compact' ? 2 : 4, summaryHeight = narrow ? 10 : 9
  const summaryGroup: Record<NodeSummaryMetric, NodeOverviewGroup> = { messages: 'device', backlog: 'buffer', cpu: 'resources', heap: 'resources' }
  const visibleSummaries = nodeOverviewSummaryMetrics.filter(metric => available.includes(summaryGroup[metric]))
  const summaries = nodeOverviewSummaryMetrics.map(metric => {
    const index = visibleSummaries.indexOf(metric), row = Math.floor(Math.max(0, index) / summaryColumns)
    const columns = Math.min(summaryColumns, visibleSummaries.length - row * summaryColumns) || 1, w = 12 / columns
    return { id: `summary-${metric}`, type: 'summary', visible: index >= 0, componentProps: { gridItem: {
      x: Math.max(0, index) % summaryColumns * w, y: row * summaryHeight, w, h: summaryHeight, minW: summaryColumns === 2 ? 6 : 3, minH: summaryHeight, maxH: 24,
    } } }
  })
  let y = Math.ceil(visibleSummaries.length / summaryColumns) * summaryHeight
  const groupTop = y
  const groups = nodeOverviewGroups.map(type => {
    const h = heights[type], visible = available.includes(type), paired = wide && available.includes('device') && available.includes('buffer') && type !== 'resources'
    const position = paired ? groupTop : y, x = paired && type === 'buffer' ? 6 : 0
    if (visible) y = paired ? Math.max(y, groupTop + h) : y + h
    return { id: type, type, visible, componentProps: { gridItem: { x, y: position, w: paired ? 6 : 12, h, minW: wide ? 6 : 12, minH: h, maxH: 100 } } }
  })
  return { canvas: { backgroundColor: 'transparent', gridLayout: { rowHeight: 10, marginHorizontal: 8, marginVertical: 6 } }, components: [...summaries, ...groups] }
}

/** 只保存个人坐标；未取得账号范围时不写缓存，不共享不同节点或窄屏坐标。 */
export function nodeOverviewLayoutKey(scope: string | undefined, nodeId: string, mode: NodeOverviewLayout) {
  return scope ? `${scope}:overview-layout:v2:${encodeURIComponent(nodeId)}:${mode}` : undefined
}
