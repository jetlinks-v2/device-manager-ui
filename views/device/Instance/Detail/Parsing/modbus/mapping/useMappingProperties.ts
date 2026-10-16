import type { ModbusSimpleMapping, PropertyUiMeta } from '../types'
import { computed } from 'vue'
import type { MappingConfiguration } from './useMappingConfiguration'
import type { AddressHelpers } from '../protocol/address'

/** 从原组件搬迁 MappingProperties，保持原有业务规则与执行逻辑。 */
export function useMappingProperties(
  mappingConfiguration: Pick<MappingConfiguration, 'metadataProperties' | 'mappings'>,
  addressHelpers: Pick<AddressHelpers, 'doParseRegisterStr'>
) {
  const { metadataProperties, mappings } = mappingConfiguration
  const { doParseRegisterStr } = addressHelpers

  /** 与 ModbusRegisterType：离散/输入寄存器无写功能码；四类均有读功能码 */
  function modbusZoneSupportsWrite(modbusType: string | undefined): boolean {
    if (!modbusType) return true
    return modbusType === 'Coils' || modbusType === 'HoldingRegisters'
  }

  function modbusZoneSupportsRead(modbusType: string | undefined): boolean {
    if (!modbusType) return true
    return (
      modbusType === 'Coils' ||
      modbusType === 'DiscreteInputs' ||
      modbusType === 'HoldingRegisters' ||
      modbusType === 'InputRegisters'
    )
  }

  /**
   * 属性列附加展示：物模型说明、读写标签；与当前寄存器区功能码冲突时标红 + 提示。
   * expands.type：read / write / report（上报视为可读语义，与运行态属性页一致）
   */
  function getPropertyUiMeta(record: ModbusSimpleMapping): PropertyUiMeta | null {
    if (!record.property) return null
    const meta = metadataProperties.value.find((p) => p.id === record.property)
    if (!meta) return null
    const parsed = doParseRegisterStr(record.registerStr)
    const zone = parsed?.type
    const types = meta.expands?.type
    let thingRead = true
    let thingWrite = true
    if (types && types.length > 0) {
      thingRead = types.includes('read') || types.includes('report')
      thingWrite = types.includes('write')
    }
    return {
      description: meta.description?.trim() || undefined,
      thingRead,
      thingWrite,
      conflictRead: thingRead && !modbusZoneSupportsRead(zone),
      conflictWrite: thingWrite && !modbusZoneSupportsWrite(zone)
    }
  }

  /** 物模型属性下拉候选项（AutoComplete 仍可输入任意字符串，不必在列表中） */
  const propertyOptions = computed(() =>
    metadataProperties.value.map((p) => ({
      value: p.id,
      searchText: `${p.name} ${p.id}`.toLowerCase(),
      propName: p.name,
      propId: p.id,
      label: p.name,
      dataType: p.valueType?.type
    }))
  )

  /** 物模型中已定义属性 id → 名称（用于输入框收起态展示） */
  function getPropNameById(propertyId: string | undefined): string | undefined {
    if (!propertyId || !String(propertyId).trim()) return undefined
    const p = metadataProperties.value.find((x) => x.id === propertyId)
    const n = p?.name?.trim()
    return n || undefined
  }

  /** 有内容且物模型中不存在该属性 id */
  function isPropertyNotInThingModel(propertyId: string | undefined): boolean {
    if (!propertyId || !String(propertyId).trim()) return false
    return !metadataProperties.value.some((p) => p.id === propertyId)
  }

  function filterPropertyACOption(input: string, option: any) {
    const t = (input || '').toLowerCase().trim()
    if (!t) return true
    const st = option?.searchText ?? `${option?.propName ?? ''} ${option?.value ?? ''}`.toLowerCase()
    return String(st).includes(t)
  }

  const encodePropertyOptions = computed(() =>
    mappings.value
      .filter((m) => m.property)
      .map((m) => ({
        value: m.property,
        label: m.propertyName ? `${m.propertyName}（${m.property}）` : m.property
      }))
  )

  function filterEncodeReadPropOption(
    input: string,
    option: {
      label?: string
      value?: string
    }
  ) {
    const q = (input || '').trim().toLowerCase()
    if (!q) return true
    const label = String(option?.label ?? '').toLowerCase()
    const value = String(option?.value ?? '').toLowerCase()
    return label.includes(q) || value.includes(q)
  }
  return {
    modbusZoneSupportsWrite,
    modbusZoneSupportsRead,
    getPropertyUiMeta,
    propertyOptions,
    getPropNameById,
    isPropertyNotInThingModel,
    filterPropertyACOption,
    encodePropertyOptions,
    filterEncodeReadPropOption
  }
}
export type MappingProperties = ReturnType<typeof useMappingProperties>
