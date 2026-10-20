import type { ModbusTranslate } from '../types'
import { message } from 'ant-design-vue'
import { computed } from 'vue'
import type { DebugState } from './useDebugState'
import type { AddressHelpers } from '../protocol/address'
import type { SimulationHelpers } from '../protocol/simulation'
import type { MappingConfiguration } from '../mapping/useMappingConfiguration'
import type { PayloadHelpers } from '../protocol/payload'

/** 从原组件搬迁 DecodeSimulation，保持原有业务规则与执行逻辑。 */
export function useDecodeSimulation(
  translate: ModbusTranslate,
  debugState: Pick<
    DebugState,
    'decodeSimError' | 'decodeSimAddressStr' | 'decodeSimBytes' | 'decodeSimFcLabel' | 'decodePayload'
  >,
  addressHelpers: Pick<AddressHelpers, 'doParseRegisterStr'>,
  simulationHelpers: Pick<SimulationHelpers, 'buildRandomReadResponse'>,
  mappingConfiguration: Pick<MappingConfiguration, 'modbusLinkType'>,
  payloadHelpers: Pick<PayloadHelpers, 'bytesToHexSpaced'>
) {
  const { decodeSimError, decodeSimAddressStr, decodeSimBytes, decodeSimFcLabel, decodePayload } = debugState
  const { doParseRegisterStr } = addressHelpers
  const { buildRandomReadResponse } = simulationHelpers
  const { modbusLinkType } = mappingConfiguration
  const { bytesToHexSpaced } = payloadHelpers

  function regenerateDecodeSimFrame() {
    decodeSimError.value = ''
    const s = decodeSimAddressStr.value.trim()
    if (!s) {
      decodeSimBytes.value = []
      decodeSimFcLabel.value = ''
      return
    }
    const parsed = doParseRegisterStr(s)
    if (!parsed) {
      decodeSimError.value = translate('ModbusMapping.validation.address')
      decodeSimBytes.value = []
      decodeSimFcLabel.value = ''
      return
    }
    const built = buildRandomReadResponse(parsed, modbusLinkType.value)
    if (!built) {
      decodeSimError.value = translate('ModbusMapping.validation.simulationSize')
      decodeSimBytes.value = []
      decodeSimFcLabel.value = ''
      return
    }
    decodeSimBytes.value = built.bytes
    decodeSimFcLabel.value = built.fcLabel
  }

  function refreshDecodeSimFrame() {
    regenerateDecodeSimFrame()
  }

  function applyDecodeSimToPayload() {
    if (!decodeSimBytes.value.length) {
      message.warning(translate('ModbusMapping.validation.simulationAddress'))
      return
    }
    decodePayload.value = bytesToHexSpaced(decodeSimBytes.value)
    message.success(translate('ModbusMapping.feedback.payloadApplied'))
  }

  const decodeSimHexFull = computed(() => (decodeSimBytes.value.length ? bytesToHexSpaced(decodeSimBytes.value) : '—'))

  const decodeSimHexShort = computed(() => {
    const full = decodeSimHexFull.value
    if (full === '—') return '—'
    const max = 96
    return full.length > max ? `${full.slice(0, max)}…` : full
  })

  const decodeSimMetaLine = computed(() => {
    if (!decodeSimBytes.value.length || !decodeSimFcLabel.value) return ''
    const linkLabel =
      modbusLinkType.value === 'TCP' ? 'Modbus TCP' : modbusLinkType.value === 'RTU' ? 'Modbus RTU' : 'Modbus PDU'
    return translate('ModbusMapping.simulation.metadata', {
      frameType: linkLabel,
      functionName: decodeSimFcLabel.value,
      bytes: decodeSimBytes.value.length
    })
  })
  return {
    regenerateDecodeSimFrame,
    refreshDecodeSimFrame,
    applyDecodeSimToPayload,
    decodeSimHexFull,
    decodeSimHexShort,
    decodeSimMetaLine
  }
}
export type DecodeSimulation = ReturnType<typeof useDecodeSimulation>
