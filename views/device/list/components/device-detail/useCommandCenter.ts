
import { computed, ref, watch } from 'vue'
import { findTypeItem } from '@device-manager-ui/components/Metadata/components/Type/data'
import { useI18n } from 'vue-i18n'
import type { IotDeviceCommandDefinition, IotDeviceCommandExecution, IotDeviceLog } from '../../types'
import type { DevicePropertyValue } from '../../services/iotDeviceDetailReal.service'
import type { RealtimePropertyRow } from './iotDeviceDetail.types'
import { useIotDeviceCommandHistory } from './useIotDeviceCommandHistory'
import { useIotDevicePropertyOperation } from './useIotDevicePropertyOperation'

export type Pane = 'property' | 'function'

export interface CommandCenterProps {
  deviceId: string
  properties: RealtimePropertyRow[]
  commands: IotDeviceCommandDefinition[]
  logs: IotDeviceLog[]
  result: IotDeviceCommandExecution | null
  busy: boolean
}

export interface CommandCenterEmits {
  execute: [commandId: string, params: Record<string, any>]
  'property-value': [value: DevicePropertyValue]
}

export function useCommandCenter(props: Readonly<CommandCenterProps>, emit: { (event: 'execute', commandId: string, params: Record<string, any>): void; (event: 'property-value', value: DevicePropertyValue): void }) {
  const { t: $t } = useI18n()
  const activePane = ref<Pane>('property')
  const keyword = ref('')
  const invokeOpen = ref(false)
  const activeCommand = ref<IotDeviceCommandDefinition | null>(null)
  const {
    selectedProperty,
    selectedTone,
    readOpen,
    writeOpen,
    reading,
    writing,
    openRead,
    openWrite,
    readSelectedProperty,
    writeSelectedProperty,
  } = useIotDevicePropertyOperation({
    deviceId: () => props.deviceId,
    onValue: (value) => {
      emit('property-value', value)
      void loadHistory()
    },
  })
  const { historyRows, loadHistory } = useIotDeviceCommandHistory(
    () => props.deviceId,
    () => props.logs,
    () => props.properties,
    () => props.commands,
  )

  watch(() => props.result?.id, () => {
    if (props.result?.id) void loadHistory()
  })

  const filteredProperties = computed(() => {
    const value = keyword.value.trim().toLowerCase()
    return props.properties.filter((item) => !value || [item.name, item.identifier, item.dataType].join(' ').toLowerCase().includes(value))
  })

  const filteredCommands = computed(() => {
    const value = keyword.value.trim().toLowerCase()
    return props.commands.filter((item) => !value || [item.name, item.identifier, item.description].join(' ').toLowerCase().includes(value))
  })

  function propertyTypeLabel(item: RealtimePropertyRow) {
    const type = String(item.valueType?.type || item.dataType || '')
    return findTypeItem(type)?.label || type || '--'
  }

  function propertyActionTypes(item: RealtimePropertyRow) {
    const type = item.expands?.type
    // 兼容历史物模型将访问方式保存为逗号分隔字符串的情况。
    return Array.isArray(type) ? type : typeof type === 'string' ? type.split(',').map((item) => item.trim()) : []
  }

  function canReadProperty(item: RealtimePropertyRow) {
    return propertyActionTypes(item).includes('read')
  }

  function canWriteProperty(item: RealtimePropertyRow) {
    return propertyActionTypes(item).includes('write')
  }

  function propertyActionHint(item: RealtimePropertyRow, action: 'read' | 'write') {
    if ((action === 'read' && canReadProperty(item)) || (action === 'write' && canWriteProperty(item))) {
      return undefined
    }
    return $t(`IotDeviceDetail.commandCenter.${action}Unsupported`)
  }

  function propertyAccessMode(item: RealtimePropertyRow) {
    const readable = canReadProperty(item)
    const writable = canWriteProperty(item)
    if (readable && writable) return 'rw'
    if (writable) return 'write'
    if (readable) return 'read'
    return 'report'
  }

  function propertyAccessText(item: RealtimePropertyRow) {
    const mode = propertyAccessMode(item)
    if (mode === 'rw') return $t('IotDeviceDetail.commandCenter.access.rw')
    if (mode === 'write') return $t('IotDeviceDetail.commandCenter.access.write')
    if (mode === 'read') return $t('IotDeviceDetail.commandCenter.access.read')
    return $t('IotDeviceDetail.commandCenter.access.report')
  }

  function commandCallModeText(command: IotDeviceCommandDefinition) {
    return command.callMode === 'async'
      ? $t('IotDeviceDetail.commands.callMode.async')
      : $t('IotDeviceDetail.commands.callMode.sync')
  }

  function commandInputSummary(command: IotDeviceCommandDefinition) {
    return command.inputParams.length
      ? commandParameterNames(command.inputParams)
      : $t('IotDeviceDetail.commands.noInputParams')
  }

  function commandParameterNames(params: IotDeviceCommandDefinition['inputParams']) {
    return params.map((param) => param.name || param.key).join('、')
  }

  function commandParameterTooltip(params: IotDeviceCommandDefinition['inputParams']) {
    return params
      .map((param) => `${param.name || param.key}(${param.key})-${commandParamTypeLabel(param.type)}`)
      .join('；')
  }

  function commandParamTypeLabel(type: IotDeviceCommandDefinition['inputParams'][number]['type']) {
    return $t(`IotDeviceDetail.commands.paramTypeText.${type}`)
  }

  function hasCommandOutput(command: IotDeviceCommandDefinition) {
    return command.callMode === 'sync' && command.outputParams.length > 0
  }

  function openInvoke(command: IotDeviceCommandDefinition) {
    activeCommand.value = command
    invokeOpen.value = true
  }

  function onExecuteCommand(commandId: string, params: Record<string, any>) {
    emit('execute', commandId, params)
  }

  function handleKeywordSearch(value: string) {
    keyword.value = String(value || '')
  }

  return { propertyTypeLabel, activePane, filteredProperties, filteredCommands, selectedProperty, selectedTone, readOpen, writeOpen, reading, writing, openRead, openWrite, readSelectedProperty, writeSelectedProperty, invokeOpen, activeCommand, historyRows, propertyAccessMode, propertyAccessText, propertyActionHint, canReadProperty, canWriteProperty, commandCallModeText, commandInputSummary, commandParameterNames, commandParameterTooltip, hasCommandOutput, openInvoke, onExecuteCommand, handleKeywordSearch }

}
