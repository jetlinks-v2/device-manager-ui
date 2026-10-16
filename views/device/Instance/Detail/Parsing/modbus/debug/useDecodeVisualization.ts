import type { DecodeVisualSegment, DecodeVisualPayload, ModbusTranslate } from '../types'
import { computed } from 'vue'
import type { DebugState } from './useDebugState'
import type { VisualizationHelpers } from '../protocol/visualization'
import type { Decode } from './useDecode'
import type { FrameHelpers } from '../protocol/frames'
import type { MappingConfiguration } from '../mapping/useMappingConfiguration'

/** 从原组件搬迁 DecodeVisualization，保持原有业务规则与执行逻辑。 */
export function useDecodeVisualization(
  translate: ModbusTranslate,
  debugState: Pick<DebugState, 'decodeResult' | 'decodePduCoilBase' | 'decodeHoverSegmentId'>,
  visualizationHelpers: Pick<
    VisualizationHelpers,
    | 'mergeReportProperties'
    | 'buildRegisterDecodeSegments'
    | 'applySegmentsToMatrices'
    | 'buildCoilDecodeSegments'
    | 'buildGlobalBitOverlapSet'
    | 'segmentTouchesByteRange'
    | 'decodeBitValueClass'
    | 'segmentCoversBitIndex'
  >,
  decode: Pick<Decode, 'decodeInputNormalized'>,
  frameHelpers: Pick<FrameHelpers, 'extractModbusResponseDataBytes' | 'FC_NAMES'>,
  mappingConfiguration: Pick<MappingConfiguration, 'modbusLinkType' | 'mappings'>
) {
  const { decodeResult, decodePduCoilBase, decodeHoverSegmentId } = debugState
  const {
    mergeReportProperties,
    buildRegisterDecodeSegments,
    applySegmentsToMatrices,
    buildCoilDecodeSegments,
    buildGlobalBitOverlapSet,
    segmentTouchesByteRange,
    decodeBitValueClass,
    segmentCoversBitIndex
  } = visualizationHelpers
  const { decodeInputNormalized } = decode
  const { extractModbusResponseDataBytes, FC_NAMES } = frameHelpers
  const { modbusLinkType, mappings } = mappingConfiguration

  const decodeVisualPayload = computed((): DecodeVisualPayload | null => {
    const dr = decodeResult.value
    if (!dr?.success || !Array.isArray(dr.outputs)) return null
    const props = mergeReportProperties(dr.outputs)
    if (!Object.keys(props).length) return null
    const bytes = decodeInputNormalized.value.bytes
    if (!bytes.length) return null
    const ext = extractModbusResponseDataBytes(bytes, modbusLinkType.value)
    if (!ext?.data.length) {
      return {
        kind: 'fallback',
        props,
        data: [],
        fc: 0,
        fcLabel: '—',
        note: translate('ModbusMapping.visual.noDataField')
      }
    }
    const { data, fc } = ext
    const fcLabel = FC_NAMES.value[fc] || translate('ModbusMapping.frame.functionCode', { code: fc.toString(16) })
    if (fc === 0x03 || fc === 0x04) {
      const { segments, warnings, unmappedProps, minPdu } = buildRegisterDecodeSegments(
        props,
        mappings.value,
        data.length
      )
      const { byteTone, bitTone, warnings: w2 } = applySegmentsToMatrices(data.length, segments, warnings)
      if (segments.length) {
        return {
          kind: 'grid',
          fc,
          fcLabel,
          pduKind: 'word',
          data,
          segments,
          byteTone,
          bitTone,
          unmappedProps,
          warnings: w2,
          minPdu
        }
      }
      return {
        kind: 'fallback',
        props,
        data,
        fc,
        fcLabel,
        note: translate('ModbusMapping.visual.wordAlignment')
      }
    }
    if (fc === 0x01 || fc === 0x02) {
      const { segments, warnings, unmappedProps, minBitPdu } = buildCoilDecodeSegments(
        props,
        mappings.value,
        data.length,
        decodePduCoilBase.value
      )
      const { byteTone, bitTone, warnings: w2 } = applySegmentsToMatrices(data.length, segments, warnings)
      if (segments.length) {
        return {
          kind: 'grid',
          fc,
          fcLabel,
          pduKind: 'bit',
          data,
          segments,
          byteTone,
          bitTone,
          unmappedProps,
          warnings: w2,
          minPdu: minBitPdu
        }
      }
      return {
        kind: 'fallback',
        props,
        data,
        fc,
        fcLabel,
        note: translate('ModbusMapping.visual.bitAlignment')
      }
    }
    return {
      kind: 'fallback',
      props,
      data,
      fc,
      fcLabel,
      note: translate('ModbusMapping.visual.unsupportedFunction')
    }
  })

  function hoveredDecodeSegment(): DecodeVisualSegment | null {
    const p = decodeVisualPayload.value
    const id = decodeHoverSegmentId.value
    if (!p || p.kind !== 'grid' || !id) return null
    return p.segments.find((s) => s.propertyId === id) ?? null
  }

  /** 读响应 PDU 数据区字节（与映射解码使用同一提取逻辑），用于未解码时的字节条 */
  const decodePduStrip = computed(
    (): {
      data: number[]
      fc: number
    } | null => {
      const bytes = decodeInputNormalized.value.bytes
      if (!bytes.length) return null
      const ext = extractModbusResponseDataBytes(bytes, modbusLinkType.value)
      if (!ext?.data.length) return null
      return ext
    }
  )

  /** 解码成功且可展示网格映射（着色 + 属性行） */
  const decodeShowMappingGrid = computed(
    () => !!decodeResult.value?.success && decodeVisualPayload.value?.kind === 'grid'
  )

  /** 被多段映射覆盖的全局位下标（不展示这些位的值边框与悬停圈选） */
  const decodeBitOverlapSet = computed(() => {
    const p = decodeVisualPayload.value
    if (!p || p.kind !== 'grid') return new Set<number>()
    return buildGlobalBitOverlapSet(p.segments)
  })

  /** 保持/输入寄存器：每 2 字节一个字，外层寄存器框 */
  const decodeWordRegisterGroups = computed(() => {
    const p = decodeVisualPayload.value
    if (!p || p.kind !== 'grid' || p.pduKind !== 'word') {
      return [] as {
        start: number
        bytes: number[]
      }[]
    }
    const out: {
      start: number
      bytes: number[]
    }[] = []
    const d = p.data
    for (let i = 0; i < d.length; i += 2) {
      out.push({ start: i, bytes: d.slice(i, i + 2) })
    }
    return out
  })

  /** 悬停属性行：高亮对应寄存器外框（字=2 字节，位=单字节块） */
  function decodeRegWrapHoverClass(pduKind: 'word' | 'bit', regIndex: number): string {
    if (!decodeHoverSegmentId.value) return ''
    const seg = hoveredDecodeSegment()
    if (!seg) return ''
    if (pduKind === 'word') {
      const bi0 = regIndex * 2
      const bi1 = bi0 + 1
      return segmentTouchesByteRange(seg, bi0, bi1) ? 'dvm-reg-wrap--hover' : ''
    }
    return segmentTouchesByteRange(seg, regIndex, regIndex) ? 'dvm-reg-wrap--hover' : ''
  }

  /**
   * PDU 单个字节的 Hex 底色类：
   * - 该字节 8 位同属一个映射段 → byteTone≥0，用对应 dvm-t-n；
   * - 同一字节内多位分属不同属性（多种色号）→ byteTone=-1 但 bitTone 已有着色 → 用 dvm-byte-hex--mixed（实线），避免误用 dvm-t-x 虚线；
   * - 整字节均未映射 → dvm-t-x（虚线表示未参与映射）。
   */
  function decodeByteHexSurfaceClass(bi: number): string {
    const p = decodeVisualPayload.value
    if (!p || p.kind !== 'grid') return 'dvm-t-x'
    const bt = p.byteTone[bi]
    if (bt >= 0) return `dvm-t-${bt}`
    const row = p.bitTone[bi]
    if (!row) return 'dvm-t-x'
    const hasMappedBit = row.some((t) => t >= 0)
    if (hasMappedBit) return 'dvm-byte-hex--mixed'
    return 'dvm-t-x'
  }

  function decodeBitCellClass(bi: number, bj: number): string {
    const p = decodeVisualPayload.value
    const byteVal = p?.kind === 'grid' ? (p.data[bi] ?? 0) : 0
    const g = bi * 8 + bj
    const ov = decodeBitOverlapSet.value.has(g)
    const vCls = decodeBitValueClass(byteVal, bj, ov)
    if (!p || p.kind !== 'grid') return `dvm-bit dvm-t-x ${vCls}`.trim()
    const t = p.bitTone[bi]?.[bj]
    const bt = p.byteTone[bi]
    let cls: string
    if (t !== undefined && t >= 0) cls = `dvm-bit dvm-t-${t} ${vCls}`.trim()
    else if (bt >= 0) cls = `dvm-bit dvm-t-${bt} ${vCls}`.trim()
    else cls = `dvm-bit dvm-t-x ${vCls}`.trim()
    const h = hoveredDecodeSegment()
    // 按字：仅寄存器外框高亮；按位：寄存器框 + 对应位（下边框）
    if (p.pduKind === 'bit' && h && segmentCoversBitIndex(h, bi, bj) && !ov) cls += ' dvm-bit--hover-sel'
    return cls
  }
  return {
    decodeVisualPayload,
    hoveredDecodeSegment,
    decodePduStrip,
    decodeShowMappingGrid,
    decodeBitOverlapSet,
    decodeWordRegisterGroups,
    decodeRegWrapHoverClass,
    decodeByteHexSurfaceClass,
    decodeBitCellClass
  }
}
export type DecodeVisualization = ReturnType<typeof useDecodeVisualization>
