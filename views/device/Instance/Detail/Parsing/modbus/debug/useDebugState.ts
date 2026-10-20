import type { EncodeInput } from '../types'
import { ref, watch } from 'vue'

/** 从原组件搬迁 DebugState，保持原有业务规则与执行逻辑。 */
export function useDebugState() {
  // Debug
  const decodePayload = ref('')

  /** 读响应 PDU 数据区：第 1 个数据位（各字节 bit0 起算）对应的线圈地址（0 基）。仅粘贴响应时若读从 0 起则为 0；若响应只含子区间请填该区间起始线圈地址。 */
  const decodePduCoilBase = ref(0)

  const decoding = ref(false)

  const decodeResult = ref<any>(null)

  /** 鼠标悬停在下方的映射属性行时，对应 PDU 字节/位高亮 */
  const decodeHoverSegmentId = ref<string | null>(null)

  watch(decodeResult, () => {
    decodeHoverSegmentId.value = null
  })

  /** 解码区：按地址模拟读响应（PDU/TCP/RTU 与左侧链路类型一致；地址串与映射表规则相同） */
  const decodeSimAddressStr = ref('')

  const decodeSimBytes = ref<number[]>([])

  const decodeSimFcLabel = ref('')

  const decodeSimError = ref('')

  const encodeInputs = ref<EncodeInput[]>([{ property: '', value: '' }])

  const encoding = ref(false)

  const encodeResult = ref<any>(null)

  /** 编码调试：写属性 / 读属性 */
  const encodeDebugMode = ref<'write' | 'read'>('write')

  /** 读属性编码：属性 id 列表（Select tags 可手输） */
  const readEncodeProps = ref<string[]>([])
  return {
    decodePayload,
    decodePduCoilBase,
    decoding,
    decodeResult,
    decodeHoverSegmentId,
    decodeSimAddressStr,
    decodeSimBytes,
    decodeSimFcLabel,
    decodeSimError,
    encodeInputs,
    encoding,
    encodeResult,
    encodeDebugMode,
    readEncodeProps
  }
}
export type DebugState = ReturnType<typeof useDebugState>
