import type { ModbusParseView, ModbusTranslate } from '../types'
import { computed } from 'vue'
import type { PayloadHelpers } from './payload'

/** 从原组件搬迁 FrameHelpers，保持原有业务规则与执行逻辑。 */
export function createFrameHelpers(
  translate: ModbusTranslate,
  payloadHelpers: Pick<PayloadHelpers, 'crc16Modbus' | 'bytesToHexSpaced'>
) {
  const { crc16Modbus, bytesToHexSpaced } = payloadHelpers

  const FC_NAMES = computed<Record<number, string>>(() => ({
    0x01: translate('ModbusMapping.function.readCoils'),
    0x02: translate('ModbusMapping.function.readDiscrete'),
    0x03: translate('ModbusMapping.function.readHolding'),
    0x04: translate('ModbusMapping.function.readInput'),
    0x05: translate('ModbusMapping.function.writeCoil'),
    0x06: translate('ModbusMapping.function.writeRegister'),
    0x0f: translate('ModbusMapping.function.writeCoils'),
    0x10: translate('ModbusMapping.function.writeRegisters'),
    0x16: translate('ModbusMapping.function.maskWrite')
  }))

  const EXC_NAMES = computed<Record<number, string>>(() => ({
    1: translate('ModbusMapping.exception.function'),
    2: translate('ModbusMapping.exception.address'),
    3: translate('ModbusMapping.exception.value'),
    4: translate('ModbusMapping.exception.device')
  }))

  /** 按所选链路类型解析上行原始字节（与后端 ModbusFrameCodec.decode 一致） */
  function parseModbusPayload(bytes: number[], link: 'PDU' | 'TCP' | 'RTU'): ModbusParseView | null {
    const warnings: string[] = []
    if (link === 'PDU') {
      if (bytes.length < 2) return null
      const unit = bytes[0]
      const fc = bytes[1]
      const pduTail = bytes.slice(2)
      return buildPduView(translate('ModbusMapping.frame.barePdu'), undefined, unit, fc, pduTail, undefined, warnings)
    }
    if (link === 'TCP') {
      if (bytes.length < 8) {
        warnings.push(translate('ModbusMapping.validation.tcpMinimum'))
        return null
      }
      const proto = (bytes[2] << 8) | bytes[3]
      if (proto !== 0) {
        warnings.push(translate('ModbusMapping.validation.protocolId'))
        return null
      }
      const mbapLen = (bytes[4] << 8) | bytes[5]
      if (mbapLen < 2) {
        warnings.push(translate('ModbusMapping.validation.mbapMinimum'))
        return null
      }
      if (bytes.length < 6 + mbapLen) {
        warnings.push(translate('ModbusMapping.validation.tcpIncomplete'))
        return null
      }
      const tid = (bytes[0] << 8) | bytes[1]
      const unit = bytes[6]
      const fc = bytes[7]
      const pduTail = bytes.slice(8, 6 + mbapLen)
      const tcpHeader = translate('ModbusMapping.frame.mbap', { transactionId: tid, length: mbapLen, unitId: unit })
      return buildPduView('Modbus TCP', tcpHeader, unit, fc, pduTail, undefined, warnings)
    }
    // RTU
    if (bytes.length < 4) return null
    const crcRx = bytes[bytes.length - 2] | (bytes[bytes.length - 1] << 8)
    const crcCalc = crc16Modbus(bytes, 0, bytes.length - 2)
    const crcOk = crcCalc === crcRx
    const slave = bytes[0]
    const fc = bytes[1]
    const pduTail = bytes.slice(2, -2)
    const crcLine = translate('ModbusMapping.frame.crc', {
      receivedLow: (crcRx & 0xff).toString(16).padStart(2, '0').toUpperCase(),
      receivedHigh: ((crcRx >> 8) & 0xff).toString(16).padStart(2, '0').toUpperCase(),
      calculatedLow: (crcCalc & 0xff).toString(16).padStart(2, '0').toUpperCase(),
      calculatedHigh: ((crcCalc >> 8) & 0xff).toString(16).padStart(2, '0').toUpperCase(),
      status: crcOk ? ' ✓' : ' ✗'
    })
    if (!crcOk) {
      warnings.push(translate('ModbusMapping.validation.crc'))
    }
    return buildPduView('Modbus RTU', undefined, slave, fc, pduTail, { crcLine, crcOk }, warnings)
  }

  function buildPduView(
    linkTypeLabel: string,
    tcpHeader: string | undefined,
    unitId: number,
    fc: number,
    pduTail: number[],
    crc:
      | {
          crcLine: string
          crcOk: boolean
        }
      | undefined,
    warnings: string[]
  ): ModbusParseView {
    const isExc = (fc & 0x80) !== 0
    const fcBase = fc & 0x7f
    if (isExc) {
      const code = pduTail[0] ?? 0
      const fcLabel = translate('ModbusMapping.frame.exception', {
        functionName:
          FC_NAMES.value[fcBase] || translate('ModbusMapping.frame.functionCode', { code: fcBase.toString(16) })
      })
      return {
        linkTypeLabel,
        tcpHeader,
        unitId,
        fcCode: fcBase,
        fcLabel,
        isException: true,
        exceptionLabel: translate('ModbusMapping.frame.exceptionCode', {
          code: code,
          description: EXC_NAMES.value[code] || translate('ModbusMapping.frame.unknown')
        }),
        crcLine: crc?.crcLine,
        crcOk: crc?.crcOk,
        warnings
      }
    }
    const fcLabel =
      FC_NAMES.value[fc] || translate('ModbusMapping.frame.functionCode', { code: fc.toString(16).toUpperCase() })
    let byteCount: number | undefined
    let dataHexPreview: string | undefined
    let registerPreview:
      | {
          index: number
          hex: string
          uint16: number
        }[]
      | undefined
    let coilBitsPreview: string | undefined
    if (fc === 0x03 || fc === 0x04) {
      byteCount = pduTail[0]
      const data = pduTail.slice(1, 1 + (byteCount ?? 0))
      if (byteCount !== undefined && data.length !== byteCount) {
        warnings.push(translate('ModbusMapping.validation.byteCount'))
      }
      dataHexPreview = data.length ? bytesToHexSpaced(data) : '—'
      registerPreview = []
      for (let i = 0; i + 1 < data.length; i += 2) {
        const hi = data[i]
        const lo = data[i + 1]
        const uint16 = (hi << 8) | lo
        registerPreview.push({
          index: i / 2,
          hex: `${hi.toString(16).padStart(2, '0').toUpperCase()} ${lo.toString(16).padStart(2, '0').toUpperCase()}`,
          uint16
        })
      }
    } else if (fc === 0x01 || fc === 0x02) {
      byteCount = pduTail[0]
      const data = pduTail.slice(1, 1 + (byteCount ?? 0))
      dataHexPreview = data.length ? bytesToHexSpaced(data) : '—'
      const bits: string[] = []
      let bitNo = 0
      const maxShow = 64
      for (let bi = 0; bi < data.length && bitNo < maxShow; bi++) {
        const by = data[bi]
        for (let b = 0; b < 8 && bitNo < maxShow; b++) {
          const v = (by >> b) & 1
          bits.push(translate('ModbusMapping.frame.bitValue', { bit: bitNo, value: v }))
          bitNo++
        }
      }
      coilBitsPreview = bits.length ? bits.join('  ') + (bitNo >= maxShow ? ' …' : '') : undefined
    } else {
      dataHexPreview = pduTail.length ? bytesToHexSpaced(pduTail) : '—'
    }
    const wordRegisterCount = registerPreview?.length
    return {
      linkTypeLabel,
      tcpHeader,
      unitId,
      fcCode: fc,
      fcLabel,
      isException: false,
      byteCount,
      wordRegisterCount,
      dataHexPreview,
      registerPreview,
      coilBitsPreview,
      crcLine: crc?.crcLine,
      crcOk: crc?.crcOk,
      warnings
    }
  }

  /** 解析下行 Modbus PDU（透传编码通常为 从站 + 功能码 + 数据，无 CRC/MBAP）；与 parseModbusPayload（按链路类型）互补 */
  function parseModbusDownlinkPdu(bytes: number[]): ModbusParseView | null {
    if (bytes.length < 2) return null
    const unitId = bytes[0]
    const fc = bytes[1]
    const tail = bytes.slice(2)
    const warnings: string[] = []
    const linkTypeLabel = translate('ModbusMapping.frame.downlinkPdu')
    if (fc & 0x80) {
      const fcBase = fc & 0x7f
      const code = tail[0] ?? 0
      const fcLabel = translate('ModbusMapping.frame.exception', {
        functionName:
          FC_NAMES.value[fcBase] || translate('ModbusMapping.frame.functionCode', { code: fcBase.toString(16) })
      })
      return {
        linkTypeLabel,
        unitId,
        fcCode: fcBase,
        fcLabel,
        isException: true,
        exceptionLabel: translate('ModbusMapping.frame.exceptionCode', {
          code: code,
          description: EXC_NAMES.value[code] || translate('ModbusMapping.frame.unknown')
        }),
        warnings
      }
    }
    const fcLabelBase =
      FC_NAMES.value[fc] || translate('ModbusMapping.frame.functionCode', { code: fc.toString(16).toUpperCase() })
    if (fc === 0x01 || fc === 0x02 || fc === 0x03 || fc === 0x04) {
      if (tail.length < 4) {
        warnings.push(translate('ModbusMapping.validation.readRequest'))
        return {
          linkTypeLabel,
          unitId,
          fcCode: fc,
          fcLabel: translate('ModbusMapping.frame.request', { functionName: fcLabelBase }),
          isException: false,
          dataHexPreview: tail.length ? bytesToHexSpaced(tail) : '—',
          warnings
        }
      }
      const addr = (tail[0] << 8) | tail[1]
      const qty = (tail[2] << 8) | tail[3]
      if (qty === 0) {
        warnings.push(translate('ModbusMapping.validation.readQuantity'))
      }
      return {
        linkTypeLabel,
        unitId,
        fcCode: fc,
        fcLabel: translate('ModbusMapping.frame.request', { functionName: fcLabelBase }),
        isException: false,
        requestStartAddr: addr,
        requestQuantity: qty,
        // 读请求 PDU 尾部仅为「起始地址 + 数量」共 4 字节，已在上方展示，不再重复为「数据区」十六进制
        warnings
      }
    }
    if (fc === 0x05 || fc === 0x06) {
      if (tail.length < 4) {
        warnings.push(translate('ModbusMapping.validation.singleWrite'))
        return {
          linkTypeLabel,
          unitId,
          fcCode: fc,
          fcLabel: translate('ModbusMapping.frame.request', { functionName: fcLabelBase }),
          isException: false,
          dataHexPreview: tail.length ? bytesToHexSpaced(tail) : '—',
          warnings
        }
      }
      const addr = (tail[0] << 8) | tail[1]
      const val = (tail[2] << 8) | tail[3]
      const coilBitsPreview =
        fc === 0x05
          ? translate('ModbusMapping.frame.coilValue', {
              value: val === 0xff00 ? 'ON' : val === 0 ? 'OFF' : `0x${val.toString(16).toUpperCase()}`
            })
          : translate('ModbusMapping.frame.registerValue', {
              value: val,
              hex: val.toString(16).toUpperCase().padStart(4, '0')
            })
      return {
        linkTypeLabel,
        unitId,
        fcCode: fc,
        fcLabel: translate('ModbusMapping.frame.request', { functionName: fcLabelBase }),
        isException: false,
        requestStartAddr: addr,
        dataHexPreview: bytesToHexSpaced(tail),
        coilBitsPreview,
        warnings
      }
    }
    if (fc === 0x0f) {
      if (tail.length < 5) {
        warnings.push(translate('ModbusMapping.validation.writeCoilsShort'))
        return {
          linkTypeLabel,
          unitId,
          fcCode: fc,
          fcLabel: translate('ModbusMapping.frame.request', { functionName: fcLabelBase }),
          isException: false,
          dataHexPreview: tail.length ? bytesToHexSpaced(tail) : '—',
          warnings
        }
      }
      const addr = (tail[0] << 8) | tail[1]
      const qty = (tail[2] << 8) | tail[3]
      const byteCount = tail[4]
      const data = tail.slice(5, 5 + byteCount)
      if (data.length !== byteCount) {
        warnings.push(translate('ModbusMapping.validation.coilByteCount'))
      }
      return {
        linkTypeLabel,
        unitId,
        fcCode: fc,
        fcLabel: translate('ModbusMapping.frame.request', { functionName: fcLabelBase }),
        isException: false,
        requestStartAddr: addr,
        requestQuantity: qty,
        byteCount,
        dataHexPreview: data.length ? bytesToHexSpaced(data) : '—',
        coilBitsPreview: translate('ModbusMapping.frame.coilQuantity', { count: qty }),
        warnings
      }
    }
    if (fc === 0x10) {
      if (tail.length < 5) {
        warnings.push(translate('ModbusMapping.validation.writeRegistersShort'))
        return {
          linkTypeLabel,
          unitId,
          fcCode: fc,
          fcLabel: translate('ModbusMapping.frame.request', { functionName: fcLabelBase }),
          isException: false,
          dataHexPreview: tail.length ? bytesToHexSpaced(tail) : '—',
          warnings
        }
      }
      const addr = (tail[0] << 8) | tail[1]
      const qty = (tail[2] << 8) | tail[3]
      const byteCount = tail[4]
      const data = tail.slice(5, 5 + byteCount)
      if (data.length !== byteCount) {
        warnings.push(translate('ModbusMapping.validation.registerByteCount'))
      }
      const registerPreview: {
        index: number
        hex: string
        uint16: number
      }[] = []
      for (let i = 0; i + 1 < data.length; i += 2) {
        const hi = data[i]
        const lo = data[i + 1]
        const uint16 = (hi << 8) | lo
        registerPreview.push({
          index: i / 2,
          hex: `${hi.toString(16).padStart(2, '0').toUpperCase()} ${lo.toString(16).padStart(2, '0').toUpperCase()}`,
          uint16
        })
      }
      return {
        linkTypeLabel,
        unitId,
        fcCode: fc,
        fcLabel: translate('ModbusMapping.frame.request', { functionName: fcLabelBase }),
        isException: false,
        requestStartAddr: addr,
        requestQuantity: qty,
        byteCount,
        wordRegisterCount: registerPreview.length ? registerPreview.length : qty,
        dataHexPreview: data.length ? bytesToHexSpaced(data) : '—',
        registerPreview: registerPreview.length ? registerPreview : undefined,
        warnings
      }
    }
    if (fc === 0x16) {
      if (tail.length < 6) {
        warnings.push(translate('ModbusMapping.validation.maskWrite'))
        return {
          linkTypeLabel,
          unitId,
          fcCode: fc,
          fcLabel: translate('ModbusMapping.frame.request', { functionName: fcLabelBase }),
          isException: false,
          dataHexPreview: tail.length ? bytesToHexSpaced(tail) : '—',
          warnings
        }
      }
      const addr = (tail[0] << 8) | tail[1]
      const andMask = (tail[2] << 8) | tail[3]
      const orMask = (tail[4] << 8) | tail[5]
      const coilBitsPreview = translate('ModbusMapping.frame.maskValue', {
        andMask: andMask.toString(16).toUpperCase().padStart(4, '0'),
        orMask: orMask.toString(16).toUpperCase().padStart(4, '0')
      })
      return {
        linkTypeLabel,
        unitId,
        fcCode: fc,
        fcLabel: translate('ModbusMapping.frame.request', { functionName: fcLabelBase }),
        isException: false,
        requestStartAddr: addr,
        dataHexPreview: bytesToHexSpaced(tail),
        coilBitsPreview,
        warnings
      }
    }
    return {
      linkTypeLabel,
      unitId,
      fcCode: fc,
      fcLabel: translate('ModbusMapping.frame.downlink', { functionName: fcLabelBase }),
      isException: false,
      dataHexPreview: tail.length ? bytesToHexSpaced(tail) : '—',
      warnings
    }
  }

  /**
   * 下行请求 PDU 从单元 ID 起的字节长度（与 {@link ModbusFrameCodec#encodePduInternal} 常见帧一致）。
   * 无法识别时返回 null。
   */
  function lengthDownlinkRequestPdu(bytes: number[], start: number): number | null {
    if (start + 2 > bytes.length) return null
    const fcRaw = bytes[start + 1]
    if (fcRaw & 0x80) {
      return start + 3 <= bytes.length ? 3 : null
    }
    const fc = fcRaw & 0x7f
    if (fc === 0x01 || fc === 0x02 || fc === 0x03 || fc === 0x04) return 6
    if (fc === 0x05 || fc === 0x06) return 6
    if (fc === 0x0f) {
      if (start + 7 > bytes.length) return null
      const byteCount = bytes[start + 6]
      return 7 + byteCount
    }
    if (fc === 0x10) {
      if (start + 7 > bytes.length) return null
      const byteCount = bytes[start + 6]
      return 7 + byteCount
    }
    return null
  }

  /**
   * 将编码结果连续字节拆成多段「线级」报文（与后端多帧顺序拼接一致）：PDU 按下行请求长度切分；TCP 按 MBAP；RTU 按 PDU+CRC。
   */
  function splitEncodePayloadToWireSegments(bytes: number[], link: 'PDU' | 'TCP' | 'RTU'): number[][] {
    if (!bytes.length) return []
    if (link === 'TCP') {
      const out: number[][] = []
      let i = 0
      while (i < bytes.length) {
        if (i + 6 > bytes.length) break
        if (((bytes[i + 2] << 8) | bytes[i + 3]) !== 0) break
        const mbapLen = (bytes[i + 4] << 8) | bytes[i + 5]
        const total = 6 + mbapLen
        if (total < 8 || i + total > bytes.length) break
        out.push(bytes.slice(i, i + total))
        i += total
      }
      if (i < bytes.length) {
        if (out.length) out.push(bytes.slice(i))
        else out.push(bytes)
      }
      return out.length ? out : [bytes]
    }
    if (link === 'RTU') {
      const out: number[][] = []
      let i = 0
      while (i < bytes.length) {
        const pduLen = lengthDownlinkRequestPdu(bytes, i)
        if (pduLen == null || i + pduLen + 2 > bytes.length) break
        out.push(bytes.slice(i, i + pduLen + 2))
        i += pduLen + 2
      }
      if (i < bytes.length) {
        if (out.length) out.push(bytes.slice(i))
        else out.push(bytes)
      }
      return out.length ? out : [bytes]
    }
    const out: number[][] = []
    let i = 0
    while (i < bytes.length) {
      const pduLen = lengthDownlinkRequestPdu(bytes, i)
      if (pduLen == null || i + pduLen > bytes.length) break
      out.push(bytes.slice(i, i + pduLen))
      i += pduLen
    }
    if (i < bytes.length) {
      if (out.length) out.push(bytes.slice(i))
      else out.push(bytes)
    }
    return out.length ? out : [bytes]
  }

  /** 按链路类型从完整 ADU 得到 UnitId+功能码+数据 的 PDU 字节序列（与后端 decode 剥离规则一致） */
  function stripToPduBytes(fullBytes: number[], link: 'PDU' | 'TCP' | 'RTU'): number[] | null {
    if (link === 'PDU') return fullBytes
    if (link === 'TCP') {
      if (fullBytes.length < 8) return null
      if (((fullBytes[2] << 8) | fullBytes[3]) !== 0) return null
      const mbapLen = (fullBytes[4] << 8) | fullBytes[5]
      if (mbapLen < 2 || fullBytes.length < 6 + mbapLen) return null
      return fullBytes.slice(6, 6 + mbapLen)
    }
    if (fullBytes.length < 4) return null
    return fullBytes.slice(0, -2)
  }

  /** 从完整帧提取读响应 PDU 数据区（线圈/寄存器负载），需与左侧「链路类型」一致 */
  function extractModbusResponseDataBytes(
    fullBytes: number[],
    link: 'PDU' | 'TCP' | 'RTU'
  ): {
    data: number[]
    fc: number
  } | null {
    const pdu = stripToPduBytes(fullBytes, link)
    if (!pdu || pdu.length < 4) return null
    const fc = pdu[1]
    const bc = pdu[2]
    if (fc === 0x03 || fc === 0x04 || fc === 0x01 || fc === 0x02) {
      if (pdu.length < 3 + bc) return null
      const data = pdu.slice(3, 3 + bc)
      if (data.length !== bc) return null
      return { data, fc }
    }
    return null
  }

  /**
   * 编码调试：按链路类型剥离 TCP MBAP / RTU CRC 后，用下行 PDU 解析器解释（与后端 encode 输出一致）。
   */
  function parseEncodeDownlinkFrame(fullBytes: number[], link: 'PDU' | 'TCP' | 'RTU'): ModbusParseView | null {
    const pdu = stripToPduBytes(fullBytes, link)
    if (!pdu || pdu.length < 2) return null
    const inner = parseModbusDownlinkPdu(pdu)
    if (!inner) return null
    if (link === 'PDU') {
      return { ...inner, linkTypeLabel: translate('ModbusMapping.frame.pduRequest') }
    }
    if (link === 'TCP') {
      if (fullBytes.length < 8) return { ...inner, linkTypeLabel: translate('ModbusMapping.frame.tcpRequest') }
      const tid = (fullBytes[0] << 8) | fullBytes[1]
      const mbapLen = (fullBytes[4] << 8) | fullBytes[5]
      const unit = fullBytes[6]
      const tcpHeader = translate('ModbusMapping.frame.mbap', { transactionId: tid, length: mbapLen, unitId: unit })
      return { ...inner, linkTypeLabel: translate('ModbusMapping.frame.tcpRequest'), tcpHeader }
    }
    const crcRx = fullBytes[fullBytes.length - 2] | (fullBytes[fullBytes.length - 1] << 8)
    const crcCalc = crc16Modbus(fullBytes, 0, fullBytes.length - 2)
    const crcOk = crcCalc === crcRx
    const crcLine = translate('ModbusMapping.frame.crcLabeled', {
      receivedLow: (crcRx & 0xff).toString(16).padStart(2, '0').toUpperCase(),
      receivedHigh: ((crcRx >> 8) & 0xff).toString(16).padStart(2, '0').toUpperCase(),
      calculatedLow: (crcCalc & 0xff).toString(16).padStart(2, '0').toUpperCase(),
      calculatedHigh: ((crcCalc >> 8) & 0xff).toString(16).padStart(2, '0').toUpperCase(),
      status: crcOk ? ' ✓' : ' ✗'
    })
    const warnings = [...(inner.warnings || [])]
    if (!crcOk) {
      warnings.push(translate('ModbusMapping.validation.crc'))
    }
    return { ...inner, linkTypeLabel: translate('ModbusMapping.frame.rtuRequest'), crcLine, crcOk, warnings }
  }
  return {
    FC_NAMES,
    EXC_NAMES,
    parseModbusPayload,
    buildPduView,
    parseModbusDownlinkPdu,
    lengthDownlinkRequestPdu,
    splitEncodePayloadToWireSegments,
    stripToPduBytes,
    extractModbusResponseDataBytes,
    parseEncodeDownlinkFrame
  }
}
export type FrameHelpers = ReturnType<typeof createFrameHelpers>
