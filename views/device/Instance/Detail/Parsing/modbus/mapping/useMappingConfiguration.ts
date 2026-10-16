import type { ModbusSimpleMapping, ThingMetadataProperty, ModbusMappingProps, ModbusTranslate } from '../types'
import { useInstanceStore } from '@device-manager-ui/store/instance'
import { ref, computed } from 'vue'
import { deviceCode, saveDeviceCode } from '@device-manager-ui/api/instance'
import { message } from 'ant-design-vue'
import type { AddressHelpers } from '../protocol/address'
import type { LayoutHelpers } from '../protocol/layout'
import type { CodecHelpers } from '../protocol/codecs'
import type { MappingRules } from '../protocol/mapping'

/** 从原组件搬迁 MappingConfiguration，保持原有业务规则与执行逻辑。 */
export function useMappingConfiguration(
  translate: ModbusTranslate,
  props: ModbusMappingProps,
  addressHelpers: Pick<AddressHelpers, 'doParseRegisterStr' | 'ZONE_INFO'>,
  layoutHelpers: Pick<
    LayoutHelpers,
    'layoutWordCountForSave' | 'layoutLogicalToBackend' | 'normalizeLayoutToLogical' | 'layoutWordCountFromRegisterReg'
  >,
  codecHelpers: Pick<CodecHelpers, 'normalizeCodecId'>,
  mappingRules: Pick<MappingRules, 'toFiniteNumberOr' | 'autoFillLayout'>
) {
  const { doParseRegisterStr, ZONE_INFO } = addressHelpers
  const { layoutWordCountForSave, layoutLogicalToBackend, normalizeLayoutToLogical, layoutWordCountFromRegisterReg } =
    layoutHelpers
  const { normalizeCodecId } = codecHelpers
  const { toFiniteNumberOr, autoFillLayout } = mappingRules

  const instanceStore = useInstanceStore()

  // ==================== State ====================
  /** 与后端 ModbusThingsMapping.modbusLinkType 一致 */
  const modbusLinkType = ref<'PDU' | 'TCP' | 'RTU'>('PDU')

  const mappings = ref<ModbusSimpleMapping[]>([])

  const loading = ref(false)

  const saving = ref(false)

  const metadataProperties = computed(() => {
    const meta = instanceStore.current?.metadata
    if (!meta) return []
    try {
      const parsed = typeof meta === 'string' ? JSON.parse(meta) : meta
      return (parsed.properties || []) as ThingMetadataProperty[]
    } catch {
      return []
    }
  })

  // 与后端 ModbusThingsMapping 一致：仅 thingId + properties（寄存器定义内嵌在每条 property.register）
  const configObject = computed(() => {
    if (!mappings.value.length) return null
    const regMap = new Map<string, any>()
    mappings.value.forEach((m) => {
      const parsed = doParseRegisterStr(m.registerStr)
      if (parsed) {
        const key = `${parsed.slaveId}_${parsed.type}_${parsed.address}`
        const existing = regMap.get(key)
        const zi = ZONE_INFO.value[parsed.type]
        const isWordBitSlice = zi?.addressing === 'word' && parsed.bitIndex !== undefined
        const layoutWc = layoutWordCountForSave(parsed)
        // 字内按位：不配置布局 UI，保存时固定单字大端 AB（与 JetLinks 字内取位一致）
        const layout = isWordBitSlice
          ? 'AB'
          : layoutLogicalToBackend(normalizeLayoutToLogical(m.layout, layoutWc), layoutWc)
        if (!existing || parsed.count > (existing.registerCount || 0)) {
          const sfFallback = existing ? existing.scaleFactor : 1
          const scFallback = existing ? existing.scale : -1
          regMap.set(key, {
            key: {
              slaveId: parsed.slaveId,
              address: parsed.address,
              type: parsed.type
            },
            registerCount: Math.max(parsed.count, existing ? existing.registerCount : 0),
            codec: normalizeCodecId(m.codec || (existing ? existing.codec : '')),
            layout,
            scaleFactor: toFiniteNumberOr(m.scaleFactor, sfFallback),
            scale: Math.round(toFiniteNumberOr(m.scale, scFallback))
          })
        }
      }
    })
    const propList: any[] = []
    mappings.value.forEach((m) => {
      const parsed = doParseRegisterStr(m.registerStr)
      if (parsed) {
        const key = `${parsed.slaveId}_${parsed.type}_${parsed.address}`
        const reg = regMap.get(key)
        const bitLen =
          parsed.bitIndex !== undefined
            ? typeof m.bitLength === 'number' && m.bitLength > 0
              ? Math.min(16, Math.floor(m.bitLength))
              : 1
            : null
        const row: Record<string, unknown> = {
          property: m.property,
          register: reg,
          elementIndex: parsed.elementIndex ?? null,
          bitIndex: parsed.bitIndex ?? null,
          bitLength: bitLen,
          readable: m.readable ?? true,
          writable: m.writable ?? true
        }
        if (parsed.type === 'HoldingRegisters' && parsed.bitIndex !== undefined && m.useMaskWrite === true) {
          row.useMaskWrite = true
        }
        propList.push(row)
      }
    })
    return {
      thingId: props.thingId || instanceStore.current?.id,
      modbusLinkType: modbusLinkType.value,
      properties: propList
    }
  })

  // ==================== API: Load/Save ====================
  function normalizeModbusLinkType(v: unknown): 'PDU' | 'TCP' | 'RTU' {
    if (v === 'TCP' || v === 'RTU' || v === 'PDU') return v
    return 'PDU'
  }

  const reconstructMappings = (mapping: any): ModbusSimpleMapping[] => {
    const typeCodeMap: Record<string, number> = {
      HoldingRegisters: 3,
      InputRegisters: 4,
      Coils: 1,
      DiscreteInputs: 2
    }
    return (mapping.properties || []).map((prop: any) => {
      const reg = prop.register
      let registerStr = ''
      if (reg?.key) {
        const { slaveId, type, address } = reg.key
        const typeCode = typeCodeMap[type] || 3
        const count = reg.registerCount || 1
        registerStr = `${typeCode}_${address}`
        // 范围写法：count > 1 且非 bit 操作时使用 "fc_start-end"
        if (count > 1 && prop.bitIndex == null) {
          registerStr += `-${address + count - 1}`
        }
        if (prop.bitIndex != null) registerStr += `_${prop.bitIndex}`
        if (prop.elementIndex != null) registerStr += `@${prop.elementIndex}`
        if (slaveId && slaveId !== 1) registerStr = `${slaveId}:${registerStr}`
      }
      const metaProp = metadataProperties.value.find((p) => p.id === prop.property)
      const layoutWc = layoutWordCountFromRegisterReg(reg)
      return {
        property: prop.property ?? '',
        propertyName: metaProp?.name,
        propertyDataType: metaProp?.valueType?.type,
        registerStr,
        codec: normalizeCodecId(reg?.codec ?? ''),
        layout: normalizeLayoutToLogical(reg?.layout ?? '', layoutWc),
        scaleFactor: toFiniteNumberOr(reg?.scaleFactor, 1),
        scale: Math.round(toFiniteNumberOr(reg?.scale, -1)),
        bitLength: typeof prop.bitLength === 'number' && prop.bitLength > 0 ? prop.bitLength : undefined,
        useMaskWrite: prop.useMaskWrite === true,
        readable: prop.readable ?? true,
        writable: prop.writable ?? true
      }
    })
  }

  const loadConfig = async () => {
    const pId = props.productId || instanceStore.current?.productId
    const dId = props.thingId || instanceStore.current?.id
    if (!pId || !dId) return
    loading.value = true
    try {
      const res: any = await deviceCode(pId, dId)
      if (res.status === 200 && res.result?.provider === 'modbus') {
        const mMapping = res.result.configuration?.mapping
        if (mMapping) {
          modbusLinkType.value = normalizeModbusLinkType(mMapping.modbusLinkType)
          mappings.value = reconstructMappings(mMapping)
          mappings.value.forEach((row) => autoFillLayout(row))
        }
      }
    } finally {
      loading.value = false
    }
  }

  const saveConfig = async () => {
    const pId = props.productId || instanceStore.current?.productId
    const dId = props.thingId || instanceStore.current?.id
    if (!pId || !dId) {
      message.error(translate('ModbusMapping.feedback.deviceMissing'))
      return
    }
    if (!configObject.value) {
      message.warning(translate('ModbusMapping.feedback.mappingRequired'))
      return
    }
    saving.value = true
    try {
      const res: any = await saveDeviceCode(pId, dId, {
        provider: 'modbus',
        configuration: { mapping: configObject.value }
      })
      if (res.status === 200) {
        message.success(translate('ModbusMapping.feedback.saved'))
      }
    } finally {
      saving.value = false
    }
  }
  return {
    instanceStore,
    modbusLinkType,
    mappings,
    loading,
    saving,
    metadataProperties,
    configObject,
    normalizeModbusLinkType,
    reconstructMappings,
    loadConfig,
    saveConfig
  }
}
export type MappingConfiguration = ReturnType<typeof useMappingConfiguration>
