export interface ModbusSimpleMapping {
  property: string
  propertyName?: string
  propertyDataType?: string
  registerStr: string
  codec: string
  layout: string
  scaleFactor?: number
  scale?: number
  /**
   * 与后端 bitLength 对齐；仅从接口回显/保存时保留（例如历史多字位配置）。
   * 地址第三段为位索引；未配置时保存侧对单点默认 bitLength=1。
   */
  bitLength?: number
  /** 保持寄存器按位写是否走掩码写（0x16），与后端 useMaskWrite 一致 */
  useMaskWrite?: boolean
  readable?: boolean
  writable?: boolean
}

export interface ParsedRegister {
  slaveId: number
  address: number
  type: string
  typeName: string
  bitIndex?: number
  elementIndex?: number
  count: number
  inputFormat: 'plc' | 'fc' // 用户输入的格式：PLC 5位地址 或 FC_addr 格式
}

export interface EncodeInput {
  property: string
  value: string
}

export interface RegHintData {
  zonePrefix: string
  zoneName: string
  fcCode: string
  color: string
  bg: string
  stdAddr: string // PLC 5位地址（如 "40001"）
  stdAddrEnd?: string // PLC 5位结束地址（范围时）
  modbusAddr: number // Modbus PDU 0-based 数据地址
  modbusAddrEnd?: number // Modbus 结束地址（范围时）
  count: number
  /** bit：线圈/离散，每 Modbus 地址 1 位；word：保持/输入寄存器，每地址 16 位 */
  addressing: 'bit' | 'word'
  /** 位区：count 个位；字区：count×16 位 */
  totalBits: number
  /** 位区：⌈count/8⌉（读线圈/离散响应数据区按字节打包）；字区：count×2 */
  dataBytes: number
  /** 一行简短区说明（用于 hint 第 3 行） */
  zoneExplain: string
  bitIndex?: number
  elementIndex?: number
  slaveId?: number
  inputFormat: 'plc' | 'fc'
}

export interface ModbusDebugPersistPayload {
  v: 2 | 3
  decodePayload: string
  /** 模拟报文地址输入框 */
  decodeSimAddressStr?: string
  /** PDU 数据区起始线圈地址（0 基） */
  decodePduCoilBase?: number
  encodeInputs: EncodeInput[]
  encodeDebugMode?: 'write' | 'read'
  readEncodeProps?: string[]
}

export interface CodecSelectOption {
  value: string
  title: string
  desc: string
  /** 标量：与映射总位宽（寄存器数×16）精确匹配 */
  bits?: number
  /**
   * 标量：按完整寄存器位宽匹配（与 bits 二选一参与过滤）。
   * 例：bcd_date_time_7 为 7 字节数据，Modbus 常读 4 寄存器（64 位）。
   */
  registerBitsAligned?: number
  /** 数组：总位宽为元素位宽的整数倍且 ≥ 元素位宽 */
  arrayElementBits?: number
}

export interface ThingMetadataProperty {
  id: string
  name: string
  description?: string
  expands?: {
    type?: string[]
  }
  valueType?: {
    type: string
  }
}

export interface PropertyUiMeta {
  description?: string
  thingRead: boolean
  thingWrite: boolean
  conflictRead: boolean
  conflictWrite: boolean
}

export type LayoutLogicalId = 'BIG_ENDIAN' | 'LITTLE_ENDIAN' | 'WORD_SWAP_2' | 'WORD_REVERSE_2'

export interface LayoutSelectOption {
  value: LayoutLogicalId
  title: string
  desc: string
}

export interface DecodeNormalized {
  bytes: number[]
  sourceLabel: string
  parseError: string
  hexForApi: string
}

export interface ModbusParseView {
  linkTypeLabel: string
  tcpHeader?: string
  unitId: number
  /** 功能码数值（异常时为原功能码低 7 位） */
  fcCode: number
  fcLabel: string
  isException: boolean
  exceptionLabel?: string
  /** 下行读/写请求：PDU 起始地址（0-based） */
  requestStartAddr?: number
  /** 下行读请求：线圈/离散数量或寄存器字数；写多线圈/多寄存器时的数量 */
  requestQuantity?: number
  byteCount?: number
  /** FC03/04 数据区寄存器个数 */
  wordRegisterCount?: number
  dataHexPreview?: string
  registerPreview?: {
    index: number
    hex: string
    uint16: number
  }[]
  coilBitsPreview?: string
  crcLine?: string
  crcOk?: boolean
  warnings: string[]
}

export interface DecodeVisualSegment {
  propertyId: string
  byteStart: number
  byteLen: number
  tone: number
  displayValue: string
  rawValue: unknown
  registerHint?: string
  /** 相对 PDU 数据区起始的全局位下标（0=第 1 字节 bit0） */
  bitRanges?: {
    from: number
    to: number
  }[]
}

export type DecodeVisualPayload =
  | {
      kind: 'grid'
      fc: number
      fcLabel: string
      pduKind: 'word' | 'bit'
      data: number[]
      segments: DecodeVisualSegment[]
      byteTone: number[]
      /** 每字节 8 位色号，下标 0=LSB（bit0）…7=MSB（bit7） */
      bitTone: number[][]
      unmappedProps: string[]
      warnings: string[]
      minPdu: number
    }
  | {
      kind: 'fallback'
      props: Record<string, unknown>
      data: number[]
      fc: number
      fcLabel: string
      note?: string
    }
export type ModbusTranslate = (key: string, values?: Record<string, unknown>) => string
export interface ModbusMappingProps {
  thingId?: string
  productId?: string
}

export type ModbusMappedPayload = Extract<DecodeVisualPayload, {kind: 'grid'}>;
