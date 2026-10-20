import type { CodecSelectOption, ModbusTranslate } from '../types'
import { computed } from 'vue'
import type { AddressHelpers } from './address'

/** 从原组件搬迁 CodecHelpers，保持原有业务规则与执行逻辑。 */
export function createCodecHelpers(
  translate: ModbusTranslate,
  addressHelpers: Pick<AddressHelpers, 'doParseRegisterStr' | 'ZONE_INFO'>
) {
  const { doParseRegisterStr, ZONE_INFO } = addressHelpers

  const codecGroupOptions = computed<
    Array<{
      label: string
      options: CodecSelectOption[]
    }>
  >(() => [
    {
      label: translate('ModbusMapping.codec.group.integer'),
      options: [
        {
          value: 'bool',
          title: 'bool',
          desc: translate('ModbusMapping.codec.bool.description'),
          bits: 8
        },
        {
          value: 'int8',
          title: 'int8',
          desc: translate('ModbusMapping.codec.int8.description'),
          bits: 8
        },
        {
          value: 'int16',
          title: 'int16',
          desc: translate('ModbusMapping.codec.int16.description'),
          bits: 16
        },
        {
          value: 'unsigned_int16',
          title: 'unsigned_int16',
          desc: translate('ModbusMapping.codec.uint16.description'),
          bits: 16
        },
        {
          value: 'unsigned_int32',
          title: 'unsigned_int32',
          desc: translate('ModbusMapping.codec.uint32.description'),
          bits: 32
        },
        {
          value: 'int32',
          title: 'int32',
          desc: translate('ModbusMapping.codec.int32.description'),
          bits: 32
        },
        {
          value: 'int64',
          title: 'int64',
          desc: translate('ModbusMapping.codec.int64.description'),
          bits: 64
        }
      ]
    },
    {
      label: translate('ModbusMapping.codec.group.float'),
      options: [
        {
          value: 'ieee754_float32',
          title: 'ieee754_float32',
          desc: translate('ModbusMapping.codec.float32.description'),
          bits: 32
        },
        {
          value: 'ieee754_float64',
          title: 'ieee754_float64',
          desc: translate('ModbusMapping.codec.float64.description'),
          bits: 64
        }
      ]
    },
    {
      label: translate('ModbusMapping.codec.group.fixed'),
      options: [
        {
          value: 'Q1_15',
          title: 'Q1_15',
          desc: translate('ModbusMapping.codec.q15.description'),
          bits: 16
        },
        {
          value: 'Q1_31',
          title: 'Q1_31',
          desc: translate('ModbusMapping.codec.q31.description'),
          bits: 32
        },
        {
          value: 'Q7_9',
          title: 'Q7_9',
          desc: translate('ModbusMapping.codec.q79.description'),
          bits: 16
        },
        {
          value: 'Q8_8',
          title: 'Q8_8',
          desc: translate('ModbusMapping.codec.q88.description'),
          bits: 16
        },
        {
          value: 'Q15_1',
          title: 'Q15_1',
          desc: translate('ModbusMapping.codec.q151.description'),
          bits: 16
        },
        {
          value: 'Q31_1',
          title: 'Q31_1',
          desc: translate('ModbusMapping.codec.q311.description'),
          bits: 32
        },
        {
          value: 'fix_scaled_10',
          title: 'fix_scaled_10',
          desc: translate('ModbusMapping.codec.scaled10.description'),
          bits: 16
        }
      ]
    },
    {
      label: translate('ModbusMapping.codec.group.bcd'),
      options: [
        {
          value: 'bcd_8',
          title: 'bcd_8',
          desc: translate('ModbusMapping.codec.bcd8.description'),
          bits: 8
        },
        {
          value: 'bcd_16',
          title: 'bcd_16',
          desc: translate('ModbusMapping.codec.bcd16.description'),
          bits: 16
        },
        {
          value: 'bcd_32',
          title: 'bcd_32',
          desc: translate('ModbusMapping.codec.bcd32.description'),
          bits: 32
        },
        {
          value: 'bcd_48',
          title: 'bcd_48',
          desc: translate('ModbusMapping.codec.bcd48.description'),
          bits: 48
        },
        {
          value: 'unpacked_bcd_16',
          title: 'unpacked_bcd_16',
          desc: translate('ModbusMapping.codec.unpacked16.description'),
          bits: 16
        },
        {
          value: 'unpacked_bcd_32',
          title: 'unpacked_bcd_32',
          desc: translate('ModbusMapping.codec.unpacked32.description'),
          bits: 32
        }
      ]
    },
    {
      label: translate('ModbusMapping.codec.group.bcdDate'),
      options: [
        {
          value: 'bcd_date_time_6',
          title: 'bcd_date_time_6',
          desc: translate('ModbusMapping.codec.date6.description'),
          bits: 48
        },
        {
          value: 'bcd_date_time_7',
          title: 'bcd_date_time_7',
          desc: translate('ModbusMapping.codec.date7.description'),
          registerBitsAligned: 64
        },
        {
          value: 'bcd_date_time_8',
          title: 'bcd_date_time_8',
          desc: translate('ModbusMapping.codec.date8.description'),
          bits: 64
        },
        {
          value: 'bcd_date_4',
          title: 'bcd_date_4',
          desc: translate('ModbusMapping.codec.date4.description'),
          bits: 32
        },
        {
          value: 'bcd_date_time_12',
          title: 'bcd_date_time_12',
          desc: translate('ModbusMapping.codec.date12.description'),
          bits: 96
        }
      ]
    },
    {
      label: translate('ModbusMapping.codec.group.array'),
      options: [
        {
          value: 'bool_array',
          title: 'bool_array',
          desc: translate('ModbusMapping.codec.boolArray.description'),
          arrayElementBits: 8
        },
        {
          value: 'int8_array',
          title: 'int8_array',
          desc: translate('ModbusMapping.codec.int8Array.description'),
          arrayElementBits: 8
        },
        {
          value: 'int16_array',
          title: 'int16_array',
          desc: translate('ModbusMapping.codec.int16Array.description'),
          arrayElementBits: 16
        },
        {
          value: 'unsigned_int16_array',
          title: 'unsigned_int16_array',
          desc: translate('ModbusMapping.codec.uint16Array.description'),
          arrayElementBits: 16
        },
        {
          value: 'unsigned_int32_array',
          title: 'unsigned_int32_array',
          desc: translate('ModbusMapping.codec.uint32Array.description'),
          arrayElementBits: 32
        },
        {
          value: 'int32_array',
          title: 'int32_array',
          desc: translate('ModbusMapping.codec.int32Array.description'),
          arrayElementBits: 32
        },
        {
          value: 'int64_array',
          title: 'int64_array',
          desc: translate('ModbusMapping.codec.int64Array.description'),
          arrayElementBits: 64
        },
        {
          value: 'ieee754_float32_array',
          title: 'ieee754_float32_array',
          desc: translate('ModbusMapping.codec.float32Array.description'),
          arrayElementBits: 32
        },
        {
          value: 'ieee754_float64_array',
          title: 'ieee754_float64_array',
          desc: translate('ModbusMapping.codec.float64Array.description'),
          arrayElementBits: 64
        },
        {
          value: 'Q1_15_array',
          title: 'Q1_15_array',
          desc: translate('ModbusMapping.codec.q15Array.description'),
          arrayElementBits: 16
        },
        {
          value: 'Q1_31_array',
          title: 'Q1_31_array',
          desc: translate('ModbusMapping.codec.q31Array.description'),
          arrayElementBits: 32
        },
        {
          value: 'Q7_9_array',
          title: 'Q7_9_array',
          desc: translate('ModbusMapping.codec.q79Array.description'),
          arrayElementBits: 16
        },
        {
          value: 'Q8_8_array',
          title: 'Q8_8_array',
          desc: translate('ModbusMapping.codec.q88Array.description'),
          arrayElementBits: 16
        },
        {
          value: 'Q15_1_array',
          title: 'Q15_1_array',
          desc: translate('ModbusMapping.codec.q151Array.description'),
          arrayElementBits: 16
        },
        {
          value: 'Q31_1_array',
          title: 'Q31_1_array',
          desc: translate('ModbusMapping.codec.q311Array.description'),
          arrayElementBits: 32
        },
        {
          value: 'fix_scaled_10_array',
          title: 'fix_scaled_10_array',
          desc: translate('ModbusMapping.codec.scaled10Array.description'),
          arrayElementBits: 16
        },
        {
          value: 'bcd_8_array',
          title: 'bcd_8_array',
          desc: translate('ModbusMapping.codec.bcd8Array.description'),
          arrayElementBits: 8
        },
        {
          value: 'bcd_16_array',
          title: 'bcd_16_array',
          desc: translate('ModbusMapping.codec.bcd16Array.description'),
          arrayElementBits: 16
        },
        {
          value: 'bcd_32_array',
          title: 'bcd_32_array',
          desc: translate('ModbusMapping.codec.bcd32Array.description'),
          arrayElementBits: 32
        },
        {
          value: 'bcd_48_array',
          title: 'bcd_48_array',
          desc: translate('ModbusMapping.codec.bcd48Array.description'),
          arrayElementBits: 48
        },
        {
          value: 'bcd_date_4_array',
          title: 'bcd_date_4_array',
          desc: translate('ModbusMapping.codec.date4Array.description'),
          arrayElementBits: 32
        },
        {
          value: 'unpacked_bcd_16_array',
          title: 'unpacked_bcd_16_array',
          desc: translate('ModbusMapping.codec.unpacked16Array.description'),
          arrayElementBits: 16
        },
        {
          value: 'unpacked_bcd_32_array',
          title: 'unpacked_bcd_32_array',
          desc: translate('ModbusMapping.codec.unpacked32Array.description'),
          arrayElementBits: 32
        }
      ]
    },
    {
      label: translate('ModbusMapping.codec.group.bit'),
      options: [
        {
          value: 'lsb_bit_array',
          title: 'lsb_bit_array',
          desc: translate('ModbusMapping.codec.lsbBits.description')
        },
        {
          value: 'bit_array',
          title: 'bit_array',
          desc: translate('ModbusMapping.codec.msbBits.description')
        }
      ]
    }
  ])

  /**
   * 历史 UI / 配置里曾使用的 PascalCase 等与 jetlinks-core Codec#getId()（snake_case）对照。
   * 加载配置时归一化，避免已存数据在下拉中显示为空。
   */
  const LEGACY_CODEC_MAP: Record<string, string> = {
    BIT_ARRAY: 'bit_array',
    BitArray: 'bit_array',
    LSB_BIT_ARRAY: 'lsb_bit_array',
    LsbBitArray: 'lsb_bit_array',
    UnsignedInt16: 'unsigned_int16',
    UnsignedInt32: 'unsigned_int32',
    Int8: 'int8',
    Int16: 'int16',
    Int32: 'int32',
    Int64: 'int64',
    Bool: 'bool',
    Ieee754Float32: 'ieee754_float32',
    Ieee754Float64: 'ieee754_float64'
  }

  function normalizeCodecId(id: string | undefined | null): string {
    if (id == null || id === '') return ''
    return LEGACY_CODEC_MAP[id] ?? id
  }

  /**
   * 解析类型下拉收起态与列表主行：尽量用可读简称（如 uint16）；布尔相关用语义化中文。
   */
  function shortCodecLabel(codecId: string | undefined | null): string {
    if (codecId == null || codecId === '') return ''
    let id = normalizeCodecId(String(codecId))
    if (id === 'bool') return translate('ModbusMapping.codec.singleBit')
    if (id === 'lsb_bit_array') return translate('ModbusMapping.codec.bitArray')
    if (id === 'bit_array') return translate('ModbusMapping.codec.msbBitArray')
    if (id.endsWith('_array')) {
      const inner = id.slice(0, -'_array'.length)
      return `${shortCodecLabel(inner)}[]`
    }
    if (id.startsWith('unsigned_int')) {
      return `uint${id.slice('unsigned_int'.length)}`
    }
    if (id === 'ieee754_float32') return 'float32'
    if (id === 'ieee754_float64') return 'float64'
    return id
  }

  /**
   * 根据地址串解析出的区类型与宽度过滤 codec。
   * 0x/1x 为按位寻址，与保持/输入寄存器（16 位/字）不同，不可混用「字」类解析器。
   */
  const getCodecOptionsForCount = (registerStr: string) => {
    const res = doParseRegisterStr(registerStr)
    if (!res) return codecGroupOptions.value
    const zone = ZONE_INFO.value[res.type]
    if (!zone) return codecGroupOptions.value
    // 输入/保持寄存器 + 字内位下标（如 3_0_1）：仅解析 1 位 → 仅 bool，与线圈按位不同（此处为字内按位）
    if (zone.addressing === 'word' && res.bitIndex !== undefined) {
      return [
        {
          label: translate('ModbusMapping.codec.group.registerBit'),
          options: [
            {
              value: 'bool',
              title: 'bool',
              desc: translate('ModbusMapping.codec.registerBitHint')
            }
          ]
        }
      ]
    }
    if (zone.addressing === 'bit') {
      // 单点：标量 bool；多点：按位展开为布尔数组（与平台约定一致）
      if (res.count === 1) {
        return [
          {
            label: translate('ModbusMapping.codec.group.singleBit'),
            options: [
              {
                value: 'bool',
                title: 'bool',
                desc: translate('ModbusMapping.codec.singleBitHint')
              }
            ]
          }
        ]
      }
      return [
        {
          label: translate('ModbusMapping.codec.group.multipleBits'),
          options: [
            {
              value: 'lsb_bit_array',
              title: 'lsb_bit_array',
              desc: translate('ModbusMapping.codec.multipleBitsHint')
            },
            {
              value: 'bit_array',
              title: 'bit_array',
              desc: translate('ModbusMapping.codec.legacyBitsHint')
            }
          ]
        }
      ]
    }
    const targetBits = res.count * 16
    return codecGroupOptions.value
      .map((group) => ({
        ...group,
        options: group.options.filter((opt) => codecOptionMatchesWordWidth(opt, targetBits))
      }))
      .filter((group) => group.options.length > 0)
  }

  /** 字寄存器区：按映射总位宽过滤；bit_array / lsb_bit_array 始终可选（按字拆位） */
  const codecOptionMatchesWordWidth = (opt: CodecSelectOption, targetBits: number) => {
    if (opt.value === 'bit_array' || opt.value === 'lsb_bit_array') return true
    if (typeof opt.registerBitsAligned === 'number') {
      return targetBits === opt.registerBitsAligned
    }
    if (typeof opt.arrayElementBits === 'number') {
      return targetBits >= opt.arrayElementBits && targetBits % opt.arrayElementBits === 0
    }
    if (typeof opt.bits === 'number') return opt.bits === targetBits
    return false
  }

  /** 解析器列下方灰色说明文案（面向用户，不展开实现细节） */
  const getCodecFilterHint = (registerStr: string): string => {
    const res = doParseRegisterStr(registerStr)
    if (!res) return ''
    const zone = ZONE_INFO.value[res.type]
    if (!zone) return ''
    if (zone.addressing === 'bit') {
      if (res.count === 1) {
        return translate('ModbusMapping.codec.singleBitFilter')
      }
      return translate('ModbusMapping.codec.multipleBitsFilter', { count: res.count })
    }
    if (zone.addressing === 'word' && res.bitIndex !== undefined) {
      return translate('ModbusMapping.codec.registerBitFilter', { bitIndex: res.bitIndex })
    }
    return translate('ModbusMapping.codec.wordFilter', { count: res.count, bits: res.count * 16 })
  }

  /** 展示「缩放/精度」等数值配置：位数组、日期时间、纯布尔、数组型不展示 */
  const isNumericCodec = (codec: string) => {
    if (!codec) return true
    if (codec === 'bit_array' || codec === 'lsb_bit_array' || codec === 'bool') return false
    if (codec.includes('bcd_date_time')) return false
    if (codec.endsWith('_array')) return false
    return true
  }
  return {
    codecGroupOptions,
    LEGACY_CODEC_MAP,
    normalizeCodecId,
    shortCodecLabel,
    getCodecOptionsForCount,
    codecOptionMatchesWordWidth,
    getCodecFilterHint,
    isNumericCodec
  }
}
export type CodecHelpers = ReturnType<typeof createCodecHelpers>
