import { computed, type Ref } from 'vue'
import { useTableBodyWidth } from '../../components/useTableBodyWidth'

/** 1920px 桌面保留导航和范围侧栏后，以约 1340px 表格宽度初始化。 */
const DEFAULT_TABLE_WIDTH = 1340

export function getDeviceListColumnLayout(
  availableWidth: number,
  type: string,
  showSpace: boolean,
  showChannel: boolean,
) {
  const fixed = { selection: 32, status: 90, time: 180, action: 90, monitor: 220, channel: 100 }
  const fixedWidth = fixed.selection + fixed.status + fixed.action
    + (type === 'all' ? fixed.time * 2 : 0)
    + (type === 'gateway' ? fixed.monitor : 0)
    + (['gateway', 'video'].includes(type) && showChannel ? fixed.channel : 0)
  const areaMinimum = showSpace ? 160 : 140
  const minimumWidth = fixedWidth + 220 + 150 + 120 + areaMinimum
  const tableWidth = Math.max(minimumWidth, Math.floor(availableWidth > 0 ? availableWidth : DEFAULT_TABLE_WIDTH))
  const extra = tableWidth - minimumWidth
  // 名称和品牌有上限；其余空间由产品和范围列分配，固定列不跟随表格拉伸。
  const nameExtra = Math.min(100, Math.floor(extra * 0.3))
  const brandExtra = Math.min(80, Math.floor(extra * 0.15))
  const remaining = extra - nameExtra - brandExtra
  const productExtra = Math.round(remaining * 0.55)

  return {
    ...fixed,
    name: 220 + nameExtra,
    product: 150 + productExtra,
    brand: 120 + brandExtra,
    area: areaMinimum + remaining - productExtra,
    tableWidth,
  }
}

export function useDeviceListColumnLayout(
  panel: Ref<HTMLElement | undefined>,
  type: Ref<string>,
  showSpace: Ref<boolean>,
  showChannel: Ref<boolean>,
) {
  const width = useTableBodyWidth(panel, DEFAULT_TABLE_WIDTH)
  return computed(() => getDeviceListColumnLayout(width.value, type.value, showSpace.value, showChannel.value))
}
