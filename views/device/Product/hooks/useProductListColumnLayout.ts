import { computed, type Ref } from 'vue'
import { useTableBodyWidth } from '../../components/useTableBodyWidth'

export function getProductListColumnLayout(availableWidth: number) {
  const fixed = { deviceCount: 130, state: 90, deviceType: 170, action: 110 }
  const minimumWidth = 300 + 140 + 160 + Object.values(fixed).reduce((sum, width) => sum + width, 0)
  const tableWidth = Math.max(minimumWidth, Math.floor(availableWidth > 0 ? availableWidth : 1340))
  const extra = tableWidth - minimumWidth
  // 1340px 基准下为名称 440 / 分类 180 / 品牌 220，优先保证名称和后续业务列的层次。
  const nameExtra = Math.round(extra * 7 / 12)
  const categoryExtra = Math.round(extra / 6)
  return {
    ...fixed,
    name: 300 + nameExtra,
    category: 140 + categoryExtra,
    brand: 160 + extra - nameExtra - categoryExtra,
    tableWidth,
  }
}

export function useProductListColumnLayout(panel: Ref<HTMLElement | undefined>) {
  const width = useTableBodyWidth(panel)
  return computed(() => getProductListColumnLayout(width.value))
}
