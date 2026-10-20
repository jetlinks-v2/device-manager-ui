import type { ParsedRegister, RegHintData, ModbusTranslate } from '../types'
import { computed } from 'vue'

/** 从原组件搬迁 AddressHelpers，保持原有业务规则与执行逻辑。 */
export function createAddressHelpers(translate: ModbusTranslate) {
  // 区号 / 颜色 / 名称 / 读功能码 / 寻址方式（与 Modbus 标准一致）
  const ZONE_INFO = computed<
    Record<
      string,
      {
        prefix: string
        name: string
        fc: string
        fcWrite?: string
        color: string
        bg: string
        addressing: 'bit' | 'word'
        zoneExplain: string
      }
    >
  >(() => ({
    Coils: {
      prefix: '0x',
      name: translate('ModbusMapping.zone.coil'),
      fc: 'FC01',
      fcWrite: 'FC05/15',
      color: '#d46b08',
      bg: '#fff7e6',
      addressing: 'bit',
      zoneExplain: translate('ModbusMapping.zone.coilHint')
    },
    DiscreteInputs: {
      prefix: '1x',
      name: translate('ModbusMapping.zone.discreteInput'),
      fc: 'FC02',
      color: '#531dab',
      bg: '#f9f0ff',
      addressing: 'bit',
      zoneExplain: translate('ModbusMapping.zone.discreteHint')
    },
    HoldingRegisters: {
      prefix: '4x',
      name: translate('ModbusMapping.zone.holdingRegister'),
      fc: 'FC03',
      fcWrite: 'FC06/16/22',
      color: '#0958d9',
      bg: '#e6f4ff',
      addressing: 'word',
      zoneExplain: translate('ModbusMapping.zone.holdingHint')
    },
    InputRegisters: {
      prefix: '3x',
      name: translate('ModbusMapping.zone.inputRegister'),
      fc: 'FC04',
      color: '#389e0d',
      bg: '#f6ffed',
      addressing: 'word',
      zoneExplain: translate('ModbusMapping.zone.inputHint')
    }
  }))

  // ==================== Register Parsing (preserved from original) ====================
  /**
   * 返回寄存器类型的完整工业名称（用于 ParsedRegister.typeName 存储）
   */
  const getTypeName = (type: string) => {
    const names: Record<string, string> = {
      Coils: translate('ModbusMapping.zone.coilFull'),
      DiscreteInputs: translate('ModbusMapping.zone.discreteFull'),
      HoldingRegisters: translate('ModbusMapping.zone.holdingFull'),
      InputRegisters: translate('ModbusMapping.zone.inputFull')
    }
    return names[type] || type
  }

  /**
   * 根据寄存器类型和偏移地址，返回标准 5 位 Modbus 地址
   * HoldingRegisters: 4x → 40001+addr, InputRegisters: 3x → 30001+addr
   * Coils: 0x → 00001+addr, DiscreteInputs: 1x → 10001+addr
   */
  const getStandardAddress = (type: string, address: number): string => {
    const base: Record<string, number> = {
      Coils: 1,
      DiscreteInputs: 10001,
      HoldingRegisters: 40001,
      InputRegisters: 30001
    }
    return String((base[type] ?? 0) + address).padStart(5, '0')
  }

  /**
   * 返回寄存器类型的简短工业标签（含功能码），用于 hint 展示
   */
  const getTypeLabel = (type: string): string => {
    // 格式: 区号(地址前缀) 名称 [功能码]
    // FC03 读取 4x 区（保持寄存器 40001+），FC04 读取 3x 区（输入寄存器 30001+）
    const labels: Record<string, string> = {
      Coils: translate('ModbusMapping.zone.coilLabel'),
      DiscreteInputs: translate('ModbusMapping.zone.discreteLabel'),
      HoldingRegisters: translate('ModbusMapping.zone.holdingLabel'),
      InputRegisters: translate('ModbusMapping.zone.inputLabel')
    }
    return labels[type] || type
  }

  /**
   * 解析单个5位标准地址 → { type, address }
   * 供 doParseRegisterStr 内部复用
   */
  const parseStd5Digit = (
    val: number
  ): {
    type: string
    address: number
  } | null => {
    if (isNaN(val)) return null
    if (val >= 400001) return { type: 'HoldingRegisters', address: val - 400001 }
    if (val >= 300001) return { type: 'InputRegisters', address: val - 300001 }
    if (val >= 100001) return { type: 'DiscreteInputs', address: val - 100001 }
    if (val >= 40001) return { type: 'HoldingRegisters', address: val - 40001 }
    if (val >= 30001) return { type: 'InputRegisters', address: val - 30001 }
    if (val >= 10001) return { type: 'DiscreteInputs', address: val - 10001 }
    if (val >= 1 && val <= 9999) return { type: 'Coils', address: val - 1 }
    return null
  }

  /**
   * 解析寄存器地址字符串。
   * 寄存器数量由地址范围决定，而非 codec。
   *
   * 支持的格式：
   *   40001          单个5位地址（1个寄存器）
   *   40001-40002    5位地址范围（2个寄存器）
   *   3_0            FC格式单地址（FC03 地址0，1个寄存器）
   *   3_0-2          FC格式范围（FC03 地址0～2，共3个寄存器）
   *   3_0_7          FC格式 + 位索引（字区内 bool 读单寄存器第7位）
   *   2:40001-40002  从机地址2 + 标准地址范围
   *   3_0@5          FC格式 + 数组元素下标
   *   40001*2        旧格式（仍兼容，但推荐改用范围写法）
   */
  const doParseRegisterStr = (str: string): ParsedRegister | null => {
    if (!str) return null
    let slaveId = 1
    let s = str.trim()
    let count = 1
    let bitIndex: number | undefined
    let elementIndex: number | undefined
    // 1. 兼容旧格式 *n（解析后由范围覆盖，*n 仍可作为 fallback）
    let legacyCount: number | undefined
    if (s.includes('*')) {
      const starIdx = s.indexOf('*')
      const c = parseInt(s.slice(starIdx + 1))
      if (!isNaN(c) && c > 0) legacyCount = c
      s = s.slice(0, starIdx).trim()
    }
    // 2. 从机地址前缀："2:..."
    if (s.includes(':')) {
      const colonIdx = s.indexOf(':')
      slaveId = parseInt(s.slice(0, colonIdx))
      s = s.slice(colonIdx + 1).trim()
    }
    // 3. 元素下标后缀："...@5"
    if (s.includes('@')) {
      const atIdx = s.lastIndexOf('@')
      elementIndex = parseInt(s.slice(atIdx + 1))
      s = s.slice(0, atIdx).trim()
    }
    let type: string | null = null
    let address = -1
    const FC_MAP: Record<number, string> = {
      1: 'Coils',
      2: 'DiscreteInputs',
      3: 'HoldingRegisters',
      4: 'InputRegisters'
    }
    // 判断输入格式：含 _ 为 FC 格式，否则为 PLC 5位地址格式
    const inputFormat: 'plc' | 'fc' = s.includes('_') ? 'fc' : 'plc'
    if (s.includes('_')) {
      // ── FC 格式：fc_addr[-endAddr][_bitIndex] ──
      const underParts = s.split('_')
      const code = parseInt(underParts[0])
      type = FC_MAP[code] || null
      const addrPart = underParts[1] ?? ''
      if (addrPart.includes('-')) {
        // 范围："0-2" → 地址0起，共3个寄存器
        const dashIdx = addrPart.indexOf('-')
        address = parseInt(addrPart.slice(0, dashIdx))
        const endAddr = parseInt(addrPart.slice(dashIdx + 1))
        if (!isNaN(endAddr) && endAddr >= address) count = endAddr - address + 1
      } else {
        address = parseInt(addrPart)
        // 第三段为位索引（仅单寄存器时有效）
        if (underParts.length >= 3) {
          bitIndex = parseInt(underParts[2])
          count = 1
        }
      }
    } else {
      // ── 标准5位地址格式 ──
      if (s.includes('-')) {
        const dashIdx = s.indexOf('-')
        const startP = parseStd5Digit(parseInt(s.slice(0, dashIdx).trim()))
        const endP = parseStd5Digit(parseInt(s.slice(dashIdx + 1).trim()))
        if (startP && endP && startP.type === endP.type) {
          type = startP.type
          address = startP.address
          count = endP.address - startP.address + 1
        }
      } else {
        const p = parseStd5Digit(parseInt(s))
        if (p) {
          type = p.type
          address = p.address
        }
      }
    }
    // 旧格式 *n 兜底（当范围未能解析出 count 时使用）
    if (legacyCount !== undefined && count === 1) count = legacyCount
    if (isNaN(slaveId) || address < 0 || !type || count < 1) return null
    return { slaveId, address, type, typeName: getTypeName(type), bitIndex, elementIndex, count, inputFormat }
  }

  /** 保持寄存器 + 字内位下标（如 3_0_1）：表格内可开关掩码写 */
  function isHoldingWordBitSlice(registerStr: string): boolean {
    const p = doParseRegisterStr(registerStr)
    return !!(p && p.type === 'HoldingRegisters' && p.bitIndex !== undefined)
  }

  const getRegisterHint = (str: string): string => {
    const res = doParseRegisterStr(str)
    if (!res) return ''
    const parts: string[] = []
    // 从机地址（非默认才显示）
    if (res.slaveId !== 1) parts.push(translate('ModbusMapping.address.unitId', { unitId: res.slaveId }))
    // 类型 + 功能码（工业标准简称）
    parts.push(getTypeLabel(res.type))
    // 标准 5 位地址（如 40001）
    parts.push(`#${getStandardAddress(res.type, res.address)}`)
    const z = ZONE_INFO.value[res.type]
    if (z?.addressing === 'bit') {
      parts.push(translate('ModbusMapping.address.bitCount', { count: res.count }))
    } else {
      const byteCount = res.count * 2
      parts.push(translate('ModbusMapping.address.wordCount', { count: res.count, bytes: byteCount }))
    }
    // 位操作（字区 + bit_index，常用 bool）
    if (res.bitIndex !== undefined) parts.push(translate('ModbusMapping.address.bitIndex', { bitIndex: res.bitIndex }))
    // 数组元素下标
    if (res.elementIndex !== undefined)
      parts.push(translate('ModbusMapping.address.elementIndex', { index: res.elementIndex }))
    return parts.join('  ·  ')
  }

  /**
   * 返回结构化寄存器解析数据，供模板渲染带颜色的双行 hint 使用
   */
  const getRegisterHintData = (str: string): RegHintData | null => {
    const res = doParseRegisterStr(str)
    if (!res) return null
    const info = ZONE_INFO.value[res.type]
    if (!info) return null
    const stdAddr = getStandardAddress(res.type, res.address)
    const stdAddrEnd = res.count > 1 ? getStandardAddress(res.type, res.address + res.count - 1) : undefined
    const addressing = info.addressing
    const totalBits = addressing === 'bit' ? res.count : res.count * 16
    const dataBytes = addressing === 'bit' ? Math.ceil(res.count / 8) : res.count * 2
    return {
      zonePrefix: info.prefix,
      zoneName: info.name,
      fcCode: info.fc,
      color: info.color,
      bg: info.bg,
      stdAddr,
      stdAddrEnd,
      modbusAddr: res.address,
      modbusAddrEnd: res.count > 1 ? res.address + res.count - 1 : undefined,
      count: res.count,
      addressing,
      totalBits,
      dataBytes,
      zoneExplain: info.zoneExplain,
      bitIndex: res.bitIndex,
      elementIndex: res.elementIndex,
      slaveId: res.slaveId !== 1 ? res.slaveId : undefined,
      inputFormat: res.inputFormat
    }
  }
  return {
    ZONE_INFO,
    getTypeName,
    getStandardAddress,
    getTypeLabel,
    parseStd5Digit,
    doParseRegisterStr,
    isHoldingWordBitSlice,
    getRegisterHint,
    getRegisterHintData
  }
}
export type AddressHelpers = ReturnType<typeof createAddressHelpers>
