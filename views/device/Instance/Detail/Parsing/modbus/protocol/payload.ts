import type { DecodeNormalized, ModbusTranslate } from '../types'

/** 从原组件搬迁 PayloadHelpers，保持原有业务规则与执行逻辑。 */
export function createPayloadHelpers(translate: ModbusTranslate) {
  const bytesToHexSpaced = (arr: number[]): string =>
    arr.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')

  /** 将编码结果中的一行 Hex（空格/逗号/0x 等）转为字节，与解码区 Hex 规则一致 */
  function hexLineToBytes(line: string): number[] {
    const hexFlat = line
      .replace(/\r\n/g, '\n')
      .replace(/0x/gi, '')
      .replace(/[,;:|_\-\t\n\r \u00a0]+/g, '')
      .trim()
    if (!hexFlat.length || !/^[0-9a-fA-F]+$/.test(hexFlat) || hexFlat.length % 2 !== 0) {
      return []
    }
    const bytes: number[] = []
    for (let i = 0; i < hexFlat.length; i += 2) {
      bytes.push(parseInt(hexFlat.slice(i, i + 2), 16))
    }
    return bytes
  }

  function normalizeDecodeInput(raw: string): DecodeNormalized {
    const empty: DecodeNormalized = { bytes: [], sourceLabel: '', parseError: '', hexForApi: '' }
    const t = raw.trim()
    if (!t) return empty
    const tryParseBase64 = (s: string): number[] | null => {
      try {
        const b64 = s.replace(/\s/g, '')
        if (!b64.length) return null
        const bin = atob(b64)
        return [...bin].map((c) => c.charCodeAt(0))
      } catch {
        return null
      }
    }
    /**
     * 展平为连续十六进制串：去掉所有 0x/0X、空白、常见分隔符（空格、逗号、冒号、分号、竖线、下划线、连字符）
     * 支持：01 03 04 / 0x01,0x03 / 0x01-0x03 / 0X01\n0X03 等
     */
    function flattenHexInput(input: string): string {
      return input
        .replace(/\r\n/g, '\n')
        .replace(/0x/gi, '')
        .replace(/[,;:|_\-\t\n\r \u00a0]+/g, '')
        .trim()
    }
    const hexFlat = flattenHexInput(t)
    const isPureHex = hexFlat.length > 0 && /^[0-9a-fA-F]+$/.test(hexFlat)
    // 纯十六进制字符（仅 0-9A-F）：优先按 Hex 解析（避免与 Base64 歧义，如 AABBCCDD）
    if (isPureHex) {
      if (hexFlat.length % 2 !== 0) {
        return {
          ...empty,
          parseError: translate('ModbusMapping.validation.hexEven')
        }
      }
      const bytes: number[] = []
      for (let i = 0; i < hexFlat.length; i += 2) {
        bytes.push(parseInt(hexFlat.slice(i, i + 2), 16))
      }
      const hexLower = hexFlat.toLowerCase()
      return {
        bytes,
        sourceLabel: 'Hex',
        parseError: '',
        hexForApi: `0x${hexLower}`
      }
    }
    const b64Compact = t.replace(/\s/g, '')
    const hasB64Special = /[+/=]/.test(b64Compact)
    const looksLikeBase64 = b64Compact.length >= 4 && /^[A-Za-z0-9+/]+=*$/.test(b64Compact)
    // 含 Base64 特征字符，或整体符合 Base64 字母表
    if (hasB64Special || looksLikeBase64) {
      const b = tryParseBase64(t)
      if (b?.length) {
        const hex = b.map((x) => x.toString(16).padStart(2, '0')).join('')
        return {
          bytes: b,
          sourceLabel: 'Base64',
          parseError: '',
          hexForApi: `0x${hex}`
        }
      }
      if (hasB64Special) {
        return { ...empty, parseError: translate('ModbusMapping.validation.base64') }
      }
    }
    // 最后尝试 Base64（无 +/= 的短串等）
    const bFallback = tryParseBase64(t)
    if (bFallback?.length) {
      const hex = bFallback.map((x) => x.toString(16).padStart(2, '0')).join('')
      return {
        bytes: bFallback,
        sourceLabel: 'Base64',
        parseError: '',
        hexForApi: `0x${hex}`
      }
    }
    return {
      ...empty,
      parseError: translate('ModbusMapping.validation.payload')
    }
  }

  function crc16Modbus(bytes: number[], start: number, len: number): number {
    let crc = 0xffff
    for (let i = 0; i < len; i++) {
      crc ^= bytes[start + i]
      for (let j = 0; j < 8; j++) {
        if (crc & 1) crc = (crc >>> 1) ^ 0xa001
        else crc >>>= 1
      }
    }
    return crc & 0xffff
  }
  return { bytesToHexSpaced, hexLineToBytes, normalizeDecodeInput, crc16Modbus }
}
export type PayloadHelpers = ReturnType<typeof createPayloadHelpers>
