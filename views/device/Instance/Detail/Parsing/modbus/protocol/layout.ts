import type { ParsedRegister, LayoutLogicalId, LayoutSelectOption, ModbusTranslate } from '../types'
import type { AddressHelpers } from './address'

/** 从原组件搬迁 LayoutHelpers，保持原有业务规则与执行逻辑。 */
export function createLayoutHelpers(
  translate: ModbusTranslate,
  addressHelpers: Pick<AddressHelpers, 'ZONE_INFO' | 'doParseRegisterStr'>
) {
  const { ZONE_INFO, doParseRegisterStr } = addressHelpers

  const LAYOUT_LOGICAL_IDS = new Set<string>(['BIG_ENDIAN', 'LITTLE_ENDIAN', 'WORD_SWAP_2', 'WORD_REVERSE_2'])

  /** 收起态短标签（与类型列 shortCodec 一致：主行简短） */
  const layoutShortLabel = (logical: string | undefined): string => {
    const m: Record<string, string> = {
      BIG_ENDIAN: translate('ModbusMapping.layout.big'),
      LITTLE_ENDIAN: translate('ModbusMapping.layout.little'),
      WORD_SWAP_2: translate('ModbusMapping.layout.swap'),
      WORD_REVERSE_2: translate('ModbusMapping.layout.reverse')
    }
    return m[logical || ''] || logical || ''
  }

  /** 后端 ByteLayout id → 界面逻辑 id（兼容历史配置中的 AB、AB_CD 等） */
  const layoutBackendToLogical = (backend: string, wordCount: number): LayoutLogicalId => {
    if (wordCount === 1) {
      if (backend === 'BA') return 'LITTLE_ENDIAN'
      return 'BIG_ENDIAN'
    }
    // 2 字或 3 字（6 字节）时，后端仍常用 AB_CD 族布局 id
    if (wordCount === 2 || wordCount === 3) {
      const m: Record<string, LayoutLogicalId> = {
        AB_CD: 'BIG_ENDIAN',
        DC_BA: 'LITTLE_ENDIAN',
        CD_AB: 'WORD_SWAP_2',
        BA_DC: 'WORD_REVERSE_2'
      }
      return m[backend] ?? 'BIG_ENDIAN'
    }
    if (wordCount >= 4) {
      const m: Record<string, LayoutLogicalId> = {
        AB_CD_EF_GH: 'BIG_ENDIAN',
        GH_EF_CD_AB: 'LITTLE_ENDIAN',
        BA_DC_FE_HG: 'WORD_SWAP_2',
        HG_FE_DC_BA: 'WORD_REVERSE_2'
      }
      return m[backend] ?? 'BIG_ENDIAN'
    }
    return 'BIG_ENDIAN'
  }

  /** 界面逻辑 id → 后端 ByteLayout id */
  const layoutLogicalToBackend = (logical: LayoutLogicalId, wordCount: number): string => {
    if (wordCount === 1) {
      return logical === 'LITTLE_ENDIAN' ? 'BA' : 'AB'
    }
    if (wordCount === 2 || wordCount === 3) {
      const m: Record<string, string> = {
        BIG_ENDIAN: 'AB_CD',
        LITTLE_ENDIAN: 'DC_BA',
        WORD_SWAP_2: 'CD_AB',
        WORD_REVERSE_2: 'BA_DC'
      }
      return m[logical] ?? 'AB_CD'
    }
    if (wordCount >= 4) {
      const m: Record<string, string> = {
        BIG_ENDIAN: 'AB_CD_EF_GH',
        LITTLE_ENDIAN: 'GH_EF_CD_AB',
        WORD_SWAP_2: 'BA_DC_FE_HG',
        WORD_REVERSE_2: 'HG_FE_DC_BA'
      }
      return m[logical] ?? 'AB_CD_EF_GH'
    }
    return 'AB'
  }

  const coerceLogicalForWordCount = (logical: LayoutLogicalId, wordCount: number): LayoutLogicalId => {
    if (wordCount === 1 && (logical === 'WORD_SWAP_2' || logical === 'WORD_REVERSE_2')) {
      return 'BIG_ENDIAN'
    }
    return logical
  }

  /** 将行内 layout（逻辑 id 或历史后端 id）规范为逻辑 id */
  const normalizeLayoutToLogical = (layout: string | undefined, wordCount: number): LayoutLogicalId => {
    const raw = (layout || '').trim()
    if (!raw) return 'BIG_ENDIAN'
    if (LAYOUT_LOGICAL_IDS.has(raw)) {
      return coerceLogicalForWordCount(raw as LayoutLogicalId, wordCount)
    }
    return layoutBackendToLogical(raw, wordCount)
  }

  /** 读响应 PDU 数据区字节数（按线圈数量向上取整到字节） */
  function pduCoilDataByteCount(bitCount: number): number {
    return Math.max(1, Math.ceil(bitCount / 8))
  }

  /**
   * 与 {@link ModbusThingsMapping#extractCoilRegionFromFrame} 一致：≤16 线圈时 Codec 入参固定为 2 字节（writeShort）；
   * ＞16 时为 ceil(n/8) 字节。用于保存时字计数等，不能仅用 ceil(位数/8)。
   */
  function coilCodecBufferByteCount(bitCount: number): number {
    const n = Math.max(1, bitCount)
    if (n <= 16) return 2
    return Math.ceil(n / 8)
  }

  /**
   * 线圈/离散按字节打包后的「字个数」（2 字节=1 字），用于保存时 layout 归一化；界面不再为线圈提供布局下拉。
   */
  function layoutWordCountForBitZone(bitCount: number): number {
    const bytes = coilCodecBufferByteCount(bitCount)
    if (bytes <= 1) return 0
    if (bytes % 2 !== 0) return -1
    return bytes / 2
  }

  /** 保存/归一化布局时用的「字计数」：字区=寄存器个数；位区=按字节打包后的字个数（非 1 字节且非奇数） */
  function layoutWordCountForSave(parsed: ParsedRegister): number {
    const zi = ZONE_INFO.value[parsed.type]
    if (zi?.addressing === 'bit') {
      const wc = layoutWordCountForBitZone(parsed.count)
      return wc <= 0 ? 1 : wc
    }
    return parsed.count
  }

  /** 从 API 还原行数据时，将布局与后端 ByteLayout 对齐用的字计数 */
  function layoutWordCountFromRegisterReg(reg: {
    registerCount?: number
    key?: {
      type?: string
    }
  }): number {
    const n = Math.max(1, reg?.registerCount || 1)
    const t = reg?.key?.type
    if (t === 'Coils' || t === 'DiscreteInputs') {
      const wc = layoutWordCountForBitZone(n)
      return wc <= 0 ? 1 : wc
    }
    return n
  }

  /**
   * 与 JetLinks ByteLayout 一致（2/4/6/8 字节族），按寄存器「字个数」取布局选项（仅 3x/4x）。
   */
  function getLayoutOptionsForWordCount(wc: number): LayoutSelectOption[] {
    // 单字（2 字节）：仅字内大/小端（AB/BA），无「字交换 / 字内反转」多字语义
    if (wc === 1) {
      return [
        {
          value: 'BIG_ENDIAN',
          title: translate('ModbusMapping.layout.bigTitle'),
          desc: translate('ModbusMapping.layout.singleBigHint')
        },
        {
          value: 'LITTLE_ENDIAN',
          title: translate('ModbusMapping.layout.littleTitle'),
          desc: translate('ModbusMapping.layout.singleLittleHint')
        }
      ]
    }
    if (wc === 2) {
      return [
        {
          value: 'BIG_ENDIAN',
          title: translate('ModbusMapping.layout.bigTitle'),
          desc: translate('ModbusMapping.layout.twoBigHint')
        },
        {
          value: 'LITTLE_ENDIAN',
          title: translate('ModbusMapping.layout.littleTitle'),
          desc: translate('ModbusMapping.layout.twoLittleHint')
        },
        {
          value: 'WORD_SWAP_2',
          title: translate('ModbusMapping.layout.swapTitle'),
          desc: translate('ModbusMapping.layout.twoSwapHint')
        },
        {
          value: 'WORD_REVERSE_2',
          title: translate('ModbusMapping.layout.reverseTitle'),
          desc: translate('ModbusMapping.layout.twoReverseHint')
        }
      ]
    }
    if (wc === 3) {
      return [
        {
          value: 'BIG_ENDIAN',
          title: translate('ModbusMapping.layout.bigTitle'),
          desc: translate('ModbusMapping.layout.threeBigHint')
        },
        {
          value: 'LITTLE_ENDIAN',
          title: translate('ModbusMapping.layout.littleTitle'),
          desc: translate('ModbusMapping.layout.threeLittleHint')
        },
        {
          value: 'WORD_SWAP_2',
          title: translate('ModbusMapping.layout.swapTitle'),
          desc: translate('ModbusMapping.layout.threeSwapHint')
        },
        {
          value: 'WORD_REVERSE_2',
          title: translate('ModbusMapping.layout.reverseTitle'),
          desc: translate('ModbusMapping.layout.threeReverseHint')
        }
      ]
    }
    if (wc >= 4) {
      return [
        {
          value: 'BIG_ENDIAN',
          title: translate('ModbusMapping.layout.bigTitle'),
          desc: translate('ModbusMapping.layout.fourBigHint')
        },
        {
          value: 'LITTLE_ENDIAN',
          title: translate('ModbusMapping.layout.littleTitle'),
          desc: translate('ModbusMapping.layout.fourLittleHint')
        },
        {
          value: 'WORD_SWAP_2',
          title: translate('ModbusMapping.layout.swapTitle'),
          desc: translate('ModbusMapping.layout.fourSwapHint')
        },
        {
          value: 'WORD_REVERSE_2',
          title: translate('ModbusMapping.layout.reverseTitle'),
          desc: translate('ModbusMapping.layout.fourReverseHint')
        }
      ]
    }
    return []
  }

  const getLayoutOptions = (registerStr: string): LayoutSelectOption[] => {
    const res = doParseRegisterStr(registerStr)
    if (!res) return []
    const zone = ZONE_INFO.value[res.type]
    // 线圈/离散：位打包与字寄存器不同，不在此配置字节布局（保存时按默认大端 AB）
    if (zone?.addressing === 'bit') {
      return []
    }
    // 字区：总数据字节 = 寄存器数×2；仅 1 字节时不展示布局
    const wordBytes = res.count * 2
    if (wordBytes <= 1) return []
    // 输入/保持寄存器 + 字内位下标（如 3_0_1）：仅 1 位 bool，无字节布局
    if (zone.addressing === 'word' && res.bitIndex !== undefined) {
      return []
    }
    return getLayoutOptionsForWordCount(res.count)
  }
  return {
    LAYOUT_LOGICAL_IDS,
    layoutShortLabel,
    layoutBackendToLogical,
    layoutLogicalToBackend,
    coerceLogicalForWordCount,
    normalizeLayoutToLogical,
    pduCoilDataByteCount,
    coilCodecBufferByteCount,
    layoutWordCountForBitZone,
    layoutWordCountForSave,
    layoutWordCountFromRegisterReg,
    getLayoutOptionsForWordCount,
    getLayoutOptions
  }
}
export type LayoutHelpers = ReturnType<typeof createLayoutHelpers>
