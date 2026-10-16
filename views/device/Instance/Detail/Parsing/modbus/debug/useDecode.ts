import type { ModbusParseView } from '../types'
import { computed, watch } from 'vue'
import { testCode } from '@device-manager-ui/api/instance'
import type { PayloadHelpers } from '../protocol/payload'
import type { DebugState } from './useDebugState'
import type { FrameHelpers } from '../protocol/frames'
import type { MappingConfiguration } from '../mapping/useMappingConfiguration'

/** 从原组件搬迁 Decode，保持原有业务规则与执行逻辑。 */
export function useDecode(
  payloadHelpers: Pick<PayloadHelpers, 'normalizeDecodeInput'>,
  debugState: Pick<DebugState, 'decodePayload' | 'decodeResult' | 'decoding' | 'decodePduCoilBase'>,
  frameHelpers: Pick<FrameHelpers, 'parseModbusPayload'>,
  mappingConfiguration: Pick<MappingConfiguration, 'modbusLinkType' | 'configObject' | 'mappings'>
) {
  const { normalizeDecodeInput } = payloadHelpers
  const { decodePayload, decodeResult, decoding, decodePduCoilBase } = debugState
  const { parseModbusPayload } = frameHelpers
  const { modbusLinkType, configObject, mappings } = mappingConfiguration

  const decodeInputNormalized = computed(() => normalizeDecodeInput(decodePayload.value))

  const decodeFrameAnalysis = computed((): ModbusParseView | null => {
    const n = decodeInputNormalized.value
    if (n.parseError || !n.bytes.length) return null
    return parseModbusPayload(n.bytes, modbusLinkType.value)
  })

  // ==================== Debug: Decode ====================
  let autoDecodeDebounceTimer: ReturnType<typeof setTimeout> | null = null

  /** 原始数据或映射变化时：在可识别为完整 Modbus 帧且已配置映射时自动调用解码 */
  async function tryAutoDecode() {
    const raw = decodePayload.value.trim()
    const n = normalizeDecodeInput(raw)
    if (n.parseError || !n.bytes.length) {
      decodeResult.value = null
      return
    }
    if (!decodeFrameAnalysis.value) {
      decodeResult.value = null
      return
    }
    if (!configObject.value) {
      decodeResult.value = null
      return
    }
    decoding.value = true
    decodeResult.value = null
    try {
      const res: any = await testCode({
        provider: 'modbus',
        configuration: { mapping: configObject.value },
        payload: n.hexForApi
      })
      if (res.status === 200) {
        decodeResult.value = res.result
      }
    } finally {
      decoding.value = false
    }
  }

  function scheduleAutoDecode() {
    if (autoDecodeDebounceTimer) clearTimeout(autoDecodeDebounceTimer)
    autoDecodeDebounceTimer = setTimeout(() => {
      autoDecodeDebounceTimer = null
      void tryAutoDecode()
    }, 420)
  }

  watch(decodePayload, () => scheduleAutoDecode())

  watch(decodePduCoilBase, () => scheduleAutoDecode())

  watch(
    () => mappings.value,
    () => scheduleAutoDecode(),
    { deep: true }
  )
  function stopAutoDecodeTimer() {
    if (autoDecodeDebounceTimer) {
      clearTimeout(autoDecodeDebounceTimer)
      autoDecodeDebounceTimer = null
    }
  }

  return { decodeInputNormalized, decodeFrameAnalysis, tryAutoDecode, scheduleAutoDecode, stopAutoDecodeTimer }
}
export type Decode = ReturnType<typeof useDecode>
