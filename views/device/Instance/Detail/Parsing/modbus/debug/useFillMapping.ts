import type { ModbusSimpleMapping, ModbusTranslate } from '../types'
import { ref, computed, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import type { Decode } from './useDecode'
import type { AddressHelpers } from '../protocol/address'
import type { MappingRules } from '../protocol/mapping'
import type { MappingConfiguration } from '../mapping/useMappingConfiguration'

/** 从原组件搬迁 FillMapping，保持原有业务规则与执行逻辑。 */
export function useFillMapping(
  translate: ModbusTranslate,
  decode: Pick<Decode, 'decodeFrameAnalysis'>,
  addressHelpers: Pick<AddressHelpers, 'getStandardAddress'>,
  mappingRules: Pick<MappingRules, 'autoFillLayout'>,
  mappingConfiguration: Pick<MappingConfiguration, 'mappings'>
) {
  const { decodeFrameAnalysis } = decode
  const { getStandardAddress } = addressHelpers
  const { autoFillLayout } = mappingRules
  const { mappings } = mappingConfiguration

  /** 解码区「填入映射表」弹窗 */
  const fillModalOpen = ref(false)

  const fillPduStart = ref(0)

  const fillCoilEndPdu = ref(0)

  /** 映射地址书写格式：默认 PLC 五位数，可选 FC_偏移 */
  const fillAddressFormat = ref<'plc' | 'fc'>('plc')

  /** FC03/04 多字时：合并一条范围 或 拆成每字一行 */
  const fillWordMergeMode = ref<'merge' | 'split'>('merge')

  const canFillToMapping = computed(() => {
    const a = decodeFrameAnalysis.value
    if (!a || a.isException) return false
    if (a.fcCode === 0x03 || a.fcCode === 0x04) return (a.wordRegisterCount ?? 0) >= 1
    if (a.fcCode === 0x01 || a.fcCode === 0x02) return (a.byteCount ?? 0) >= 1
    return false
  })

  const fillModalCoilMode = computed(() => {
    const a = decodeFrameAnalysis.value
    return !!a && !a.isException && (a.fcCode === 0x01 || a.fcCode === 0x02)
  })

  const fillModalWordCount = computed(() => decodeFrameAnalysis.value?.wordRegisterCount ?? 0)

  /** FC03/04 且数据区含 2 个及以上寄存器 */
  const fillModalMultiWord = computed(() => {
    const a = decodeFrameAnalysis.value
    return !!a && !a.isException && (a.fcCode === 0x03 || a.fcCode === 0x04) && (a.wordRegisterCount ?? 0) > 1
  })

  /** 线圈/离散：结束位大于起始位时提示可多映射 */
  const fillCoilMultiBit = computed(() => {
    if (!fillModalCoilMode.value) return false
    const s = fillPduStart.value ?? 0
    const e = fillCoilEndPdu.value ?? 0
    return e > s
  })

  const fillModalOkText = computed(() => {
    if (fillModalMultiWord.value && fillWordMergeMode.value === 'split') {
      return translate('ModbusMapping.action.addRows', { count: fillModalWordCount.value })
    }
    return translate('ModbusMapping.action.addRow')
  })

  /** 单个保持/输入寄存器的地址串（用于拆分填充） */
  function buildSingleWordRegisterStr(fcCode: number, pduAddr: number, slave: number): string {
    const plc = fillAddressFormat.value === 'plc'
    if (plc) {
      const type = fcCode === 0x03 ? 'HoldingRegisters' : 'InputRegisters'
      const std = getStandardAddress(type, pduAddr)
      return slave !== 1 ? `${slave}:${std}` : std
    }
    const tc = fcCode === 0x03 ? 3 : 4
    const str = `${tc}_${pduAddr}`
    return slave !== 1 ? `${slave}:${str}` : str
  }

  const fillSplitPreviewSample = computed(() => {
    if (!fillModalMultiWord.value || fillWordMergeMode.value !== 'split') return ''
    const a = decodeFrameAnalysis.value!
    const n = a.wordRegisterCount ?? 0
    const s = fillPduStart.value ?? 0
    const slave = a.unitId
    const lines: string[] = []
    const maxShow = 8
    for (let k = 0; k < Math.min(n, maxShow); k++) {
      lines.push(buildSingleWordRegisterStr(a.fcCode, s + k, slave))
    }
    if (n > maxShow) lines.push(translate('ModbusMapping.preview.totalRows', { count: n }))
    return lines.join('\n')
  })

  /** 根据弹窗状态生成映射表「寄存器地址」字符串（PLC 或 FC 格式） */
  function buildFillRegisterStrFromState(): string {
    const a = decodeFrameAnalysis.value
    if (!a || a.isException) return ''
    const s = fillPduStart.value ?? 0
    const slave = a.unitId
    const plc = fillAddressFormat.value === 'plc'
    if (a.fcCode === 0x03 || a.fcCode === 0x04) {
      const n = a.wordRegisterCount ?? 0
      if (n < 1) return ''
      const e = s + n - 1
      if (plc) {
        const type = a.fcCode === 0x03 ? 'HoldingRegisters' : 'InputRegisters'
        const stdS = getStandardAddress(type, s)
        const stdE = getStandardAddress(type, e)
        let str = s === e ? stdS : `${stdS}-${stdE}`
        if (slave !== 1) str = `${slave}:${str}`
        return str
      }
      const tc = a.fcCode === 0x03 ? 3 : 4
      let str = `${tc}_${s}`
      if (e > s) str += `-${e}`
      if (slave !== 1) str = `${slave}:${str}`
      return str
    }
    if (a.fcCode === 0x01 || a.fcCode === 0x02) {
      const e = fillCoilEndPdu.value ?? 0
      if (plc) {
        const type = a.fcCode === 0x01 ? 'Coils' : 'DiscreteInputs'
        const stdS = getStandardAddress(type, s)
        const stdE = getStandardAddress(type, e)
        let str = s === e ? stdS : `${stdS}-${stdE}`
        if (slave !== 1) str = `${slave}:${str}`
        return str
      }
      const tc = a.fcCode === 0x01 ? 1 : 2
      let str = `${tc}_${s}-${e}`
      if (slave !== 1) str = `${slave}:${str}`
      return str
    }
    return ''
  }

  const fillMappingPreviewStr = computed(() => buildFillRegisterStrFromState())

  function suggestCodecForWordCount(n: number): string {
    if (n === 1) return 'unsigned_int16'
    if (n === 2) return 'unsigned_int32'
    if (n === 4) return 'ieee754_float64'
    return ''
  }

  function openFillMappingModal() {
    if (!canFillToMapping.value) return
    const a = decodeFrameAnalysis.value!
    fillAddressFormat.value = 'plc'
    fillWordMergeMode.value = 'merge'
    fillPduStart.value = 0
    if (a.fcCode === 0x01 || a.fcCode === 0x02) {
      const bc = a.byteCount ?? 1
      fillCoilEndPdu.value = Math.max(0, bc * 8 - 1)
    } else {
      fillCoilEndPdu.value = 0
    }
    fillModalOpen.value = true
  }

  function confirmFillMapping() {
    const a = decodeFrameAnalysis.value
    if (!a || !canFillToMapping.value) {
      fillModalOpen.value = false
      return Promise.resolve()
    }
    const s = fillPduStart.value ?? 0
    if (a.fcCode === 0x03 || a.fcCode === 0x04) {
      const n = a.wordRegisterCount ?? 0
      if (n < 1) {
        message.warning(translate('ModbusMapping.validation.wordCount'))
        return Promise.reject()
      }
      if (n > 1 && fillWordMergeMode.value === 'split') {
        for (let k = 0; k < n; k++) {
          const pdu = s + k
          const registerStr = buildSingleWordRegisterStr(a.fcCode, pdu, a.unitId)
          const row: ModbusSimpleMapping = {
            property: '',
            registerStr,
            codec: 'unsigned_int16',
            layout: '',
            scaleFactor: 1,
            scale: -1,
            readable: true,
            writable: true
          }
          autoFillLayout(row)
          mappings.value.push(row)
        }
        message.success(translate('ModbusMapping.feedback.rowsAdded', { count: n }))
        fillModalOpen.value = false
        nextTick(() => {
          document.querySelector('.mm-table')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        })
        return Promise.resolve()
      }
      const registerStr = buildFillRegisterStrFromState()
      if (!registerStr) {
        message.warning(translate('ModbusMapping.validation.generatedAddress'))
        return Promise.reject()
      }
      const row: ModbusSimpleMapping = {
        property: '',
        registerStr,
        codec: suggestCodecForWordCount(n),
        layout: '',
        scaleFactor: 1,
        scale: -1,
        readable: true,
        writable: true
      }
      autoFillLayout(row)
      mappings.value.push(row)
      message.success(
        n > 1 ? translate('ModbusMapping.feedback.rangeAdded') : translate('ModbusMapping.feedback.rowAdded')
      )
      fillModalOpen.value = false
      nextTick(() => {
        document.querySelector('.mm-table')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
      return Promise.resolve()
    }
    if (a.fcCode === 0x01 || a.fcCode === 0x02) {
      const e = fillCoilEndPdu.value ?? 0
      if (e < s) {
        message.warning(translate('ModbusMapping.validation.endBit'))
        return Promise.reject()
      }
      const registerStr = buildFillRegisterStrFromState()
      if (!registerStr) {
        message.warning(translate('ModbusMapping.validation.generatedAddress'))
        return Promise.reject()
      }
      const singleBit = e === s
      const row: ModbusSimpleMapping = {
        property: '',
        registerStr,
        codec: singleBit ? 'bool' : 'lsb_bit_array',
        layout: '',
        scaleFactor: 1,
        scale: -1,
        readable: true,
        writable: true
      }
      autoFillLayout(row)
      mappings.value.push(row)
      message.success(translate('ModbusMapping.feedback.bitMappingAdded'))
      fillModalOpen.value = false
      nextTick(() => {
        document.querySelector('.mm-table')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
      return Promise.resolve()
    }
    fillModalOpen.value = false
    return Promise.resolve()
  }
  return {
    fillModalOpen,
    fillPduStart,
    fillCoilEndPdu,
    fillAddressFormat,
    fillWordMergeMode,
    canFillToMapping,
    fillModalCoilMode,
    fillModalWordCount,
    fillModalMultiWord,
    fillCoilMultiBit,
    fillModalOkText,
    buildSingleWordRegisterStr,
    fillSplitPreviewSample,
    buildFillRegisterStrFromState,
    fillMappingPreviewStr,
    suggestCodecForWordCount,
    openFillMappingModal,
    confirmFillMapping
  }
}
export type FillMapping = ReturnType<typeof useFillMapping>
