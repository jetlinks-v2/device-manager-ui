import type { ModbusDebugPersistPayload, ModbusMappingProps } from '../types'
import { nextTick, watch } from 'vue'
import type { MappingConfiguration } from '../mapping/useMappingConfiguration'
import type { DebugState } from './useDebugState'
import type { DecodeSimulation } from './useDecodeSimulation'

/** 从原组件搬迁 DebugDraft，保持原有业务规则与执行逻辑。 */
export function useDebugDraft(
  props: ModbusMappingProps,
  mappingConfiguration: Pick<MappingConfiguration, 'instanceStore'>,
  debugState: Pick<
    DebugState,
    | 'decodePayload'
    | 'decodeSimAddressStr'
    | 'decodePduCoilBase'
    | 'encodeInputs'
    | 'encodeDebugMode'
    | 'readEncodeProps'
  >,
  decodeSimulation: Pick<DecodeSimulation, 'regenerateDecodeSimFrame'>
) {
  const { instanceStore } = mappingConfiguration
  const { decodePayload, decodeSimAddressStr, decodePduCoilBase, encodeInputs, encodeDebugMode, readEncodeProps } =
    debugState
  const { regenerateDecodeSimFrame } = decodeSimulation

  // ==================== 调试区草稿 localStorage（按设备区分） ====================
  const DEBUG_PERSIST_VERSION = 3 as const

  function modbusDebugStorageKey(): string {
    const id = props.thingId || instanceStore.current?.id || 'default'
    return `jetlinks-ui:modbus-mapping-debug:v${DEBUG_PERSIST_VERSION}:${id}`
  }

  let modbusDebugRestoring = false

  let modbusDebugPersistTimer: ReturnType<typeof setTimeout> | null = null

  let decodeSimDebounceTimer: ReturnType<typeof setTimeout> | null = null

  function restoreModbusDebugDraft() {
    if (typeof localStorage === 'undefined') return
    try {
      const raw = localStorage.getItem(modbusDebugStorageKey())
      if (!raw) return
      const data = JSON.parse(raw) as ModbusDebugPersistPayload & {
        v?: number
      }
      if ((data.v !== 2 && data.v !== 3) || typeof data.decodePayload !== 'string') return
      modbusDebugRestoring = true
      decodePayload.value = data.decodePayload
      decodeSimAddressStr.value =
        data.v === 3 && typeof data.decodeSimAddressStr === 'string' ? data.decodeSimAddressStr : ''
      decodePduCoilBase.value =
        typeof data.decodePduCoilBase === 'number' && !Number.isNaN(data.decodePduCoilBase)
          ? Math.max(0, Math.min(65535, Math.floor(data.decodePduCoilBase)))
          : 0
      if (Array.isArray(data.encodeInputs) && data.encodeInputs.length > 0) {
        encodeInputs.value = data.encodeInputs.map((row) => ({
          property: typeof row?.property === 'string' ? row.property : '',
          value: typeof row?.value === 'string' ? row.value : ''
        }))
      } else {
        encodeInputs.value = [{ property: '', value: '' }]
      }
      encodeDebugMode.value =
        data.encodeDebugMode === 'read' || data.encodeDebugMode === 'write' ? data.encodeDebugMode : 'write'
      readEncodeProps.value = Array.isArray(data.readEncodeProps)
        ? data.readEncodeProps.filter((x) => typeof x === 'string' && x.trim())
        : []
      nextTick(() => {
        modbusDebugRestoring = false
        regenerateDecodeSimFrame()
      })
    } catch {
      modbusDebugRestoring = false
    }
  }

  function persistModbusDebugDraft() {
    if (typeof localStorage === 'undefined' || modbusDebugRestoring) return
    try {
      const payload: ModbusDebugPersistPayload = {
        v: DEBUG_PERSIST_VERSION,
        decodePayload: decodePayload.value,
        decodeSimAddressStr: decodeSimAddressStr.value,
        decodePduCoilBase: decodePduCoilBase.value,
        encodeInputs: encodeInputs.value.map((r) => ({
          property: r.property ?? '',
          value: r.value ?? ''
        })),
        encodeDebugMode: encodeDebugMode.value,
        readEncodeProps: [...readEncodeProps.value]
      }
      localStorage.setItem(modbusDebugStorageKey(), JSON.stringify(payload))
    } catch {
      /* 配额或其它限制 */
    }
  }

  function schedulePersistModbusDebugDraft() {
    if (modbusDebugRestoring) return
    if (modbusDebugPersistTimer) clearTimeout(modbusDebugPersistTimer)
    modbusDebugPersistTimer = setTimeout(() => {
      modbusDebugPersistTimer = null
      persistModbusDebugDraft()
    }, 400)
  }

  watch(decodePayload, schedulePersistModbusDebugDraft)

  watch(decodePduCoilBase, schedulePersistModbusDebugDraft)

  watch(decodeSimAddressStr, () => {
    schedulePersistModbusDebugDraft()
    if (modbusDebugRestoring) return
    if (decodeSimDebounceTimer) clearTimeout(decodeSimDebounceTimer)
    decodeSimDebounceTimer = setTimeout(() => {
      decodeSimDebounceTimer = null
      regenerateDecodeSimFrame()
    }, 380)
  })

  watch(encodeInputs, schedulePersistModbusDebugDraft, { deep: true })

  watch(encodeDebugMode, schedulePersistModbusDebugDraft)

  watch(readEncodeProps, schedulePersistModbusDebugDraft, { deep: true })
  /** 与原组件卸载阶段相同：只清理原有的两个草稿/模拟防抖定时器。 */
  function stopDebugDraftTimers() {
    if (modbusDebugPersistTimer) {
      clearTimeout(modbusDebugPersistTimer)
      modbusDebugPersistTimer = null
    }
    if (decodeSimDebounceTimer) {
      clearTimeout(decodeSimDebounceTimer)
      decodeSimDebounceTimer = null
    }
  }

  return {
    DEBUG_PERSIST_VERSION,
    modbusDebugStorageKey,
    restoreModbusDebugDraft,
    persistModbusDebugDraft,
    schedulePersistModbusDebugDraft,
    stopDebugDraftTimers
  }
}
export type DebugDraft = ReturnType<typeof useDebugDraft>
