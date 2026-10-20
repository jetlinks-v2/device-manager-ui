import type { ModbusSimpleMapping, DecodeVisualSegment, ModbusTranslate } from '../types'
import type { AddressHelpers } from './address'

/** 从原组件搬迁 VisualizationHelpers，保持原有业务规则与执行逻辑。 */
export function createVisualizationHelpers(
  translate: ModbusTranslate,
  addressHelpers: Pick<AddressHelpers, 'doParseRegisterStr' | 'ZONE_INFO'>
) {
  const { doParseRegisterStr, ZONE_INFO } = addressHelpers

  function formatDecodePropValue(val: unknown): string {
    if (val == null) return String(val)
    if (Array.isArray(val)) {
      const s = JSON.stringify(val)
      return s.length > 200 ? `${s.slice(0, 200)}…` : s
    }
    if (typeof val === 'object') {
      const s = JSON.stringify(val)
      return s.length > 200 ? `${s.slice(0, 200)}…` : s
    }
    if (typeof val === 'boolean') return val ? 'true' : 'false'
    return String(val)
  }

  function mergeReportProperties(outputs: any[]): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    if (!Array.isArray(outputs)) return out
    for (const msg of outputs) {
      if (msg && typeof msg === 'object' && msg.properties && typeof msg.properties === 'object') {
        Object.assign(out, msg.properties)
      }
    }
    return out
  }

  function registerBitIndexToGlobalBit(pduWordStart: number, bitInRegister: number, minPdu: number): number {
    const wordOff = pduWordStart - minPdu
    const byteBase = wordOff * 2
    const b = bitInRegister
    // Modbus 字寄存器大端：首字节高 8 位（bit15..8），次字节低 8 位（bit7..0）
    if (b < 8) {
      return (byteBase + 1) * 8 + b
    }
    return (byteBase + 0) * 8 + (b - 8)
  }

  function buildRegisterDecodeSegments(
    props: Record<string, unknown>,
    mapRows: ModbusSimpleMapping[],
    dataLen: number
  ): {
    segments: DecodeVisualSegment[]
    minPdu: number
    unmappedProps: string[]
    warnings: string[]
  } {
    const warnings: string[] = []
    const acc: {
      prop: string
      pduStart: number
      words: number
      bitIndex?: number
    }[] = []
    const unmapped: string[] = []
    for (const k of Object.keys(props)) {
      const row = mapRows.find((m) => m.property === k)
      if (!row) {
        unmapped.push(k)
        continue
      }
      const p = doParseRegisterStr(row.registerStr)
      if (!p) {
        unmapped.push(k)
        continue
      }
      const zone = ZONE_INFO.value[p.type]
      if (!zone || zone.addressing !== 'word') {
        unmapped.push(k)
        continue
      }
      acc.push({
        prop: k,
        pduStart: p.address,
        words: Math.max(1, p.count),
        bitIndex: p.bitIndex
      })
    }
    if (!acc.length) {
      return { segments: [], minPdu: 0, unmappedProps: [...Object.keys(props)], warnings }
    }
    const minPdu = Math.min(...acc.map((r) => r.pduStart))
    const segments: DecodeVisualSegment[] = []
    let tone = 0
    for (const r of [...acc].sort((a, b) => a.pduStart - b.pduStart || (a.bitIndex ?? -1) - (b.bitIndex ?? -1))) {
      const row = mapRows.find((m) => m.property === r.prop)!
      const t = tone % 8
      tone++
      if (r.bitIndex !== undefined) {
        const g = registerBitIndexToGlobalBit(r.pduStart, r.bitIndex, minPdu)
        const byteIdx = Math.floor(g / 8)
        if (byteIdx < 0 || byteIdx >= dataLen) {
          warnings.push(translate('ModbusMapping.visual.bitOutOfRange', { property: r.prop }))
          continue
        }
        segments.push({
          propertyId: r.prop,
          byteStart: byteIdx,
          byteLen: 1,
          tone: t,
          displayValue: formatDecodePropValue(props[r.prop]),
          rawValue: props[r.prop],
          registerHint: row.registerStr,
          bitRanges: [{ from: g, to: g }]
        })
        continue
      }
      const wordOff = r.pduStart - minPdu
      const byteStart = wordOff * 2
      const byteLen = r.words * 2
      if (byteStart < 0 || byteStart + byteLen > dataLen) {
        warnings.push(
          translate('ModbusMapping.visual.bytesOutOfRange', {
            property: r.prop,
            start: byteStart,
            end: byteStart + byteLen,
            bytes: dataLen
          })
        )
        continue
      }
      segments.push({
        propertyId: r.prop,
        byteStart,
        byteLen,
        tone: t,
        displayValue: formatDecodePropValue(props[r.prop]),
        rawValue: props[r.prop],
        registerHint: row.registerStr
      })
    }
    return { segments, minPdu, unmappedProps: unmapped, warnings }
  }

  function buildCoilDecodeSegments(
    props: Record<string, unknown>,
    mapRows: ModbusSimpleMapping[],
    dataLen: number,
    /** PDU 数据区第 0 位对应的线圈地址（0 基）；与读响应起始线圈一致；默认 0 */
    pduCoilBase: number
  ): {
    segments: DecodeVisualSegment[]
    minBitPdu: number
    unmappedProps: string[]
    warnings: string[]
  } {
    const warnings: string[] = []
    const acc: {
      prop: string
      startBit: number
      bitCount: number
    }[] = []
    const unmapped: string[] = []
    for (const k of Object.keys(props)) {
      const row = mapRows.find((m) => m.property === k)
      if (!row) {
        unmapped.push(k)
        continue
      }
      const p = doParseRegisterStr(row.registerStr)
      if (!p) {
        unmapped.push(k)
        continue
      }
      const zone = ZONE_INFO.value[p.type]
      if (!zone || zone.addressing !== 'bit') {
        unmapped.push(k)
        continue
      }
      acc.push({ prop: k, startBit: p.address, bitCount: Math.max(1, p.count) })
    }
    if (!acc.length) {
      return { segments: [], minBitPdu: pduCoilBase, unmappedProps: [...Object.keys(props)], warnings }
    }
    const maxPduBit = dataLen * 8 - 1
    const segments: DecodeVisualSegment[] = []
    let tone = 0
    for (const r of [...acc].sort((a, b) => a.startBit - b.startBit)) {
      const g0 = r.startBit - pduCoilBase
      const g1 = g0 + r.bitCount - 1
      if (g1 < 0 || g0 > maxPduBit) {
        warnings.push(
          translate('ModbusMapping.visual.coilsOutOfRange', {
            property: r.prop,
            start: r.startBit,
            end: r.startBit + r.bitCount - 1,
            base: pduCoilBase,
            bytes: dataLen
          })
        )
        continue
      }
      const clip0 = Math.max(0, g0)
      const clip1 = Math.min(maxPduBit, g1)
      const byteStart = Math.floor(clip0 / 8)
      const byteEnd = Math.floor(clip1 / 8)
      const byteLen = byteEnd - byteStart + 1
      if (byteStart < 0 || byteStart + byteLen > dataLen) {
        warnings.push(translate('ModbusMapping.visual.bitBytesOutOfRange', { property: r.prop }))
        continue
      }
      const row = mapRows.find((m) => m.property === r.prop)!
      segments.push({
        propertyId: r.prop,
        byteStart,
        byteLen,
        tone: tone % 8,
        displayValue: formatDecodePropValue(props[r.prop]),
        rawValue: props[r.prop],
        registerHint: row.registerStr,
        bitRanges: [{ from: clip0, to: clip1 }]
      })
      tone++
    }
    return { segments, minBitPdu: pduCoilBase, unmappedProps: unmapped, warnings }
  }

  /** 将段映射为字节级与位级色号；无 bitRanges 时整字节 8 位同色 */
  function applySegmentsToMatrices(
    dataLen: number,
    segments: DecodeVisualSegment[],
    existingWarnings: string[]
  ): {
    byteTone: number[]
    bitTone: number[][]
    warnings: string[]
  } {
    const warnings = [...existingWarnings]
    const bitTone: number[][] = Array.from({ length: dataLen }, () => new Array(8).fill(-1))
    for (const seg of segments) {
      const paintBit = (g: number) => {
        const bi = Math.floor(g / 8)
        const bj = g % 8
        if (bi < 0 || bi >= dataLen) return
        if (bitTone[bi][bj] !== -1 && bitTone[bi][bj] !== seg.tone) {
          warnings.push(translate('ModbusMapping.visual.overlap', { bit: g, byte: bi, bitIndex: bj }))
        }
        bitTone[bi][bj] = seg.tone
      }
      if (seg.bitRanges?.length) {
        for (const br of seg.bitRanges) {
          for (let g = br.from; g <= br.to; g++) {
            paintBit(g)
          }
        }
      } else {
        for (let i = 0; i < seg.byteLen; i++) {
          const idx = seg.byteStart + i
          if (idx < 0 || idx >= dataLen) continue
          for (let bj = 0; bj < 8; bj++) {
            paintBit(idx * 8 + bj)
          }
        }
      }
    }
    const byteTone = new Array(dataLen).fill(-1)
    for (let bi = 0; bi < dataLen; bi++) {
      const filled = bitTone[bi].filter((t) => t >= 0)
      if (!filled.length) continue
      const unique = new Set(filled)
      if (unique.size === 1) byteTone[bi] = filled[0]
      else byteTone[bi] = -1
    }
    return { byteTone, bitTone, warnings }
  }

  function decodeSegmentRangeLabel(seg: DecodeVisualSegment, pduCoilBase = 0): string {
    if (seg.bitRanges?.length) {
      const r = seg.bitRanges[0]
      const c0 = r.from + pduCoilBase
      const c1 = r.to + pduCoilBase
      if (r.from === r.to) {
        return pduCoilBase
          ? translate('ModbusMapping.visual.pduCoilBit', { bit: r.from, coil: c0 })
          : translate('ModbusMapping.visual.bit', { bit: r.from })
      }
      return pduCoilBase
        ? translate('ModbusMapping.visual.pduCoilRange', { start: r.from, end: r.to, coilStart: c0, coilEnd: c1 })
        : translate('ModbusMapping.visual.bitRange', { start: r.from, end: r.to })
    }
    if (seg.byteLen <= 1) return `B${seg.byteStart}`
    return `B${seg.byteStart}–${seg.byteStart + seg.byteLen - 1}`
  }

  /** 全局位下标 g（相对 PDU 数据区）是否属于该映射段 */
  function segmentCoversGlobalBit(seg: DecodeVisualSegment, g: number): boolean {
    if (seg.bitRanges?.length) {
      return seg.bitRanges.some((br) => g >= br.from && g <= br.to)
    }
    const bi = Math.floor(g / 8)
    return bi >= seg.byteStart && bi < seg.byteStart + seg.byteLen
  }

  function segmentCoversBitIndex(seg: DecodeVisualSegment, bi: number, bj: number): boolean {
    return segmentCoversGlobalBit(seg, bi * 8 + bj)
  }

  /** 映射段是否与字节区间 [biMin, biMax] 有交集（用于寄存器外框悬停） */
  function segmentTouchesByteRange(seg: DecodeVisualSegment, biMin: number, biMax: number): boolean {
    if (seg.bitRanges?.length) {
      for (const br of seg.bitRanges) {
        for (let g = br.from; g <= br.to; g++) {
          const bi = Math.floor(g / 8)
          if (bi >= biMin && bi <= biMax) return true
        }
      }
      return false
    }
    for (let i = 0; i < seg.byteLen; i++) {
      const bi = seg.byteStart + i
      if (bi >= biMin && bi <= biMax) return true
    }
    return false
  }

  /** 多属性覆盖同一全局位时，不画位值/悬停边框 */
  function buildGlobalBitOverlapSet(segments: DecodeVisualSegment[]): Set<number> {
    const count = new Map<number, number>()
    for (const seg of segments) {
      const seen = new Set<number>()
      const add = (g: number) => {
        if (seen.has(g)) return
        seen.add(g)
        count.set(g, (count.get(g) ?? 0) + 1)
      }
      if (seg.bitRanges?.length) {
        for (const br of seg.bitRanges) {
          for (let g = br.from; g <= br.to; g++) add(g)
        }
      } else {
        for (let i = 0; i < seg.byteLen; i++) {
          const idx = seg.byteStart + i
          for (let bj = 0; bj < 8; bj++) add(idx * 8 + bj)
        }
      }
    }
    const overlap = new Set<number>()
    for (const [g, c] of count.entries()) {
      if (c > 1) overlap.add(g)
    }
    return overlap
  }

  /** 位在字节内的值（bj：0=LSB … 7=MSB），用于细边框区分 0/1；重叠位不画 */
  function decodeBitValueClass(byteVal: number, bj: number, globalOverlap?: boolean): string {
    if (globalOverlap === true) return ''
    const bit = (byteVal >> bj) & 1
    return bit ? 'dvm-bit-val-1' : 'dvm-bit-val-0'
  }
  return {
    formatDecodePropValue,
    mergeReportProperties,
    registerBitIndexToGlobalBit,
    buildRegisterDecodeSegments,
    buildCoilDecodeSegments,
    applySegmentsToMatrices,
    decodeSegmentRangeLabel,
    segmentCoversGlobalBit,
    segmentCoversBitIndex,
    segmentTouchesByteRange,
    buildGlobalBitOverlapSet,
    decodeBitValueClass
  }
}
export type VisualizationHelpers = ReturnType<typeof createVisualizationHelpers>
