import type { ModbusParseView, ModbusTranslate } from '../types'
import { computed } from 'vue'
import { message } from 'ant-design-vue'
import { encodeTest } from '@device-manager-ui/api/instance'
import type { DebugState } from './useDebugState'
import type { MappingConfiguration } from '../mapping/useMappingConfiguration'
import type { PayloadHelpers } from '../protocol/payload'
import type { FrameHelpers } from '../protocol/frames'

/** 从原组件搬迁 Encode，保持原有业务规则与执行逻辑。 */
export function useEncode(
  translate: ModbusTranslate,
  debugState: Pick<DebugState, 'encodeResult' | 'encodeInputs' | 'encodeDebugMode' | 'readEncodeProps' | 'encoding'>,
  mappingConfiguration: Pick<MappingConfiguration, 'modbusLinkType' | 'configObject'>,
  payloadHelpers: Pick<PayloadHelpers, 'hexLineToBytes' | 'bytesToHexSpaced'>,
  frameHelpers: Pick<FrameHelpers, 'splitEncodePayloadToWireSegments' | 'parseEncodeDownlinkFrame'>
) {
  const { encodeResult, encodeInputs, encodeDebugMode, readEncodeProps, encoding } = debugState
  const { modbusLinkType, configObject } = mappingConfiguration
  const { hexLineToBytes, bytesToHexSpaced } = payloadHelpers
  const { splitEncodePayloadToWireSegments, parseEncodeDownlinkFrame } = frameHelpers

  /** 编码调试：将接口返回的连续 Hex（可能含多帧拼接）拆段后逐段解析 */
  const encodeDebugSegments = computed(
    (): {
      hex: string
      analysis: ModbusParseView | null
    }[] => {
      const r = encodeResult.value
      if (!r?.success || !Array.isArray(r.frames)) return []
      const link = modbusLinkType.value
      const allBytes = r.frames.flatMap((fr: string) => hexLineToBytes(String(fr ?? '')))
      if (allBytes.length < 2) return []
      const wireChunks = splitEncodePayloadToWireSegments(allBytes, link)
      return wireChunks.map((seg) => ({
        hex: bytesToHexSpaced(seg),
        analysis: parseEncodeDownlinkFrame(seg, link)
      }))
    }
  )

  // ==================== Debug: Encode ====================
  const addEncodeInput = () => {
    encodeInputs.value.push({ property: '', value: '' })
  }

  const removeEncodeInput = (idx: number) => {
    encodeInputs.value.splice(idx, 1)
  }

  const runEncode = async () => {
    if (!configObject.value) {
      message.warning(translate('ModbusMapping.feedback.mappingRequired'))
      return
    }
    if (encodeDebugMode.value === 'read') {
      const props = readEncodeProps.value.map((s) => String(s).trim()).filter(Boolean)
      if (!props.length) {
        message.warning(translate('ModbusMapping.validation.readProperties'))
        return
      }
      encoding.value = true
      encodeResult.value = null
      try {
        const res: any = await encodeTest({
          provider: 'modbus',
          configuration: { mapping: configObject.value },
          message: { messageType: 'READ_PROPERTY', properties: props }
        })
        if (res.status === 200) {
          encodeResult.value = res.result
        }
      } finally {
        encoding.value = false
      }
      return
    }
    const valid = encodeInputs.value.filter((i) => i.property)
    if (!valid.length) {
      message.warning(translate('ModbusMapping.validation.property'))
      return
    }
    const properties: Record<string, any> = {}
    valid.forEach((item) => {
      const num = parseFloat(item.value)
      properties[item.property] = isNaN(num) ? item.value : num
    })
    encoding.value = true
    encodeResult.value = null
    try {
      const res: any = await encodeTest({
        provider: 'modbus',
        configuration: { mapping: configObject.value },
        message: { messageType: 'WRITE_PROPERTY', properties }
      })
      if (res.status === 200) {
        encodeResult.value = res.result
      }
    } finally {
      encoding.value = false
    }
  }
  return { encodeDebugSegments, addEncodeInput, removeEncodeInput, runEncode }
}
export type Encode = ReturnType<typeof useEncode>
