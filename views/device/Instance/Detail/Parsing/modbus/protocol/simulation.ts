import type { ParsedRegister } from '../types'
import type { AddressHelpers } from './address'
import type { FrameHelpers } from './frames'
import type { PayloadHelpers } from './payload'

/** 从原组件搬迁 SimulationHelpers，保持原有业务规则与执行逻辑。 */
export function createSimulationHelpers(
  addressHelpers: Pick<AddressHelpers, 'ZONE_INFO'>,
  frameHelpers: Pick<FrameHelpers, 'FC_NAMES'>,
  payloadHelpers: Pick<PayloadHelpers, 'crc16Modbus'>
) {
  const { ZONE_INFO } = addressHelpers
  const { FC_NAMES } = frameHelpers
  const { crc16Modbus } = payloadHelpers

  /** 解码调试：按地址模拟「设备 → 主站」读响应（随机数据区；PDU / TCP+MBAP / RTU+CRC 与链路类型一致） */
  const MAX_DECODE_SIM_DATA = 512

  function randomBytes(n: number): number[] {
    return Array.from({ length: n }, () => Math.floor(Math.random() * 256))
  }

  function wrapTcpMbap(pdu: number[]): number[] {
    const n = pdu.length
    const tid = 0
    return [(tid >> 8) & 0xff, tid & 0xff, 0, 0, (n >> 8) & 0xff, n & 0xff, ...pdu]
  }

  function buildRandomReadResponse(
    parsed: ParsedRegister,
    link: 'PDU' | 'TCP' | 'RTU'
  ): {
    bytes: number[]
    fcLabel: string
  } | null {
    const slave = parsed.slaveId ?? 1
    let fc: number
    if (parsed.type === 'Coils') fc = 0x01
    else if (parsed.type === 'DiscreteInputs') fc = 0x02
    else if (parsed.type === 'HoldingRegisters') fc = 0x03
    else if (parsed.type === 'InputRegisters') fc = 0x04
    else return null
    const zone = ZONE_INFO.value[parsed.type]
    if (!zone) return null
    const fcLabel = FC_NAMES.value[fc] || `FC${fc}`
    if (zone.addressing === 'bit') {
      const nBits = parsed.count
      const byteCount = Math.ceil(nBits / 8)
      if (byteCount > MAX_DECODE_SIM_DATA) return null
      const data = randomBytes(byteCount)
      const pdu = [slave, fc, byteCount, ...data]
      if (link === 'PDU') return { bytes: pdu, fcLabel }
      if (link === 'TCP') return { bytes: wrapTcpMbap(pdu), fcLabel }
      const crc = crc16Modbus(pdu, 0, pdu.length)
      return { bytes: [...pdu, crc & 0xff, (crc >> 8) & 0xff], fcLabel }
    }
    const byteCount = parsed.count * 2
    if (byteCount > MAX_DECODE_SIM_DATA) return null
    const data = randomBytes(byteCount)
    const pdu = [slave, fc, byteCount, ...data]
    if (link === 'PDU') return { bytes: pdu, fcLabel }
    if (link === 'TCP') return { bytes: wrapTcpMbap(pdu), fcLabel }
    const crc = crc16Modbus(pdu, 0, pdu.length)
    return { bytes: [...pdu, crc & 0xff, (crc >> 8) & 0xff], fcLabel }
  }
  return { MAX_DECODE_SIM_DATA, randomBytes, wrapTcpMbap, buildRandomReadResponse }
}
export type SimulationHelpers = ReturnType<typeof createSimulationHelpers>
