import type { ModbusSimpleMapping } from '../types'
import type { AddressHelpers } from './address'
import type { CodecHelpers } from './codecs'
import type { LayoutHelpers } from './layout'

/** 从原组件搬迁 MappingRules，保持原有业务规则与执行逻辑。 */
export function createMappingRules(
  addressHelpers: Pick<AddressHelpers, 'doParseRegisterStr' | 'ZONE_INFO'>,
  codecHelpers: Pick<CodecHelpers, 'normalizeCodecId' | 'getCodecOptionsForCount'>,
  layoutHelpers: Pick<LayoutHelpers, 'getLayoutOptions' | 'normalizeLayoutToLogical' | 'coerceLogicalForWordCount'>
) {
  const { doParseRegisterStr, ZONE_INFO } = addressHelpers
  const { normalizeCodecId, getCodecOptionsForCount } = codecHelpers
  const { getLayoutOptions, normalizeLayoutToLogical, coerceLogicalForWordCount } = layoutHelpers

  /** a-input-number（含 stringMode）可能为 number | string，统一为有限数字供保存与后端 JSON */
  function toFiniteNumberOr(v: unknown, fallback: number): number {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
    return fallback
  }

  const autoFillLayout = (item: ModbusSimpleMapping) => {
    const res = doParseRegisterStr(item.registerStr)
    if (!res) return
    if (item.codec) {
      const norm = normalizeCodecId(item.codec)
      if (norm !== item.codec) item.codec = norm
    }
    const zone = ZONE_INFO.value[res.type]
    if (!zone) return
    // 线圈/离散：不配置字节布局（保存时由空 layout 归一化为默认 AB）
    if (zone.addressing === 'bit') {
      if (res.count === 1 && (item.codec === 'bit_array' || item.codec === 'lsb_bit_array')) {
        item.codec = 'bool'
      }
      if (res.count > 1 && item.codec === 'bool') {
        item.codec = ''
      }
      item.layout = ''
      return
    }
    // 输入/保持寄存器 + 字内位下标：仅 bool，无布局（如 3_0_1）；先于可选 Codec 校验以免误清空
    if (zone.addressing === 'word' && res.bitIndex !== undefined) {
      item.codec = 'bool'
      item.layout = ''
      return
    }
    const validCodecs = getCodecOptionsForCount(item.registerStr).flatMap((g) =>
      (g as any).options.map((o: any) => o.value as string)
    )
    if (item.codec && !validCodecs.includes(item.codec)) {
      item.codec = ''
    }
    const opts = getLayoutOptions(item.registerStr)
    if (!opts.length) {
      item.layout = ''
      return
    }
    let logical = normalizeLayoutToLogical(item.layout, res.count)
    logical = coerceLogicalForWordCount(logical, res.count)
    const allowed = new Set(opts.map((o) => o.value))
    if (!allowed.has(logical)) {
      logical = 'BIG_ENDIAN'
    }
    item.layout = logical
  }
  return { toFiniteNumberOr, autoFillLayout }
}
export type MappingRules = ReturnType<typeof createMappingRules>
