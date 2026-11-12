import { computed, ref, watch } from 'vue'
import { recoveryCondition, validCondition, validateAlarmConditions } from '../../conditions'
import { formatRelieveText, formatTriggerText, propertyIdOf, validateNotificationMessage } from '../../utils'
import type { AlarmLevelOption, DeviceAlarmFormModel, DeviceAlarmTargetOption, ThingModelProperty } from '../../types'

export type EditorPanel = 'level' | 'target' | 'trigger' | 'notification'
type ConfigState = 'complete' | 'pending' | 'off'
interface EditorProps {
  open: boolean
  saving: boolean
  model: DeviceAlarmFormModel
  levelOptions: AlarmLevelOption[]
  propertyOptions: ThingModelProperty[]
  productOption?: DeviceAlarmTargetOption
  deviceOption?: DeviceAlarmTargetOption
}

const panels = [
  { key: 'level', icon: 'NotificationOutlined', labelKey: 'DeviceAlarm.form.level', descriptionKey: 'DeviceAlarm.editor.levelDescription' },
  { key: 'target', icon: 'AimOutlined', labelKey: 'DeviceAlarm.editor.target', descriptionKey: 'DeviceAlarm.editor.targetDescription' },
  { key: 'trigger', icon: 'ThunderboltOutlined', labelKey: 'DeviceAlarm.editor.trigger', descriptionKey: 'DeviceAlarm.editor.triggerDescription' },
  { key: 'notification', icon: 'BellOutlined', labelKey: 'DeviceAlarm.editor.notification', descriptionKey: 'DeviceAlarm.editor.notificationDescription' },
] as const

/** 弹窗内的导航、配置状态与预览共用同一草稿；只派生展示，不改变保存校验或请求资源。 */
export function useDeviceAlarmEditor(props: EditorProps, t: (key: string) => string) {
  const activePanel = ref<EditorPanel>('level')
  watch(() => props.open, (open) => {
    if (open) activePanel.value = 'level'
  })
  const activePanelMeta = computed(() => panels.find(panel => panel.key === activePanel.value) ?? panels[0])
  const selectedProperty = computed(() => props.propertyOptions.find(property => propertyIdOf(property) === props.model.property)
    ?? { valueType: { type: typeof props.model.value === 'string' ? 'string' : typeof props.model.value === 'boolean' ? 'boolean' : 'double' } })
  const empty = computed(() => t('DeviceAlarm.editor.notSelected'))
  const pending = computed(() => t('DeviceAlarm.editor.pending'))
  const level = computed(() => props.levelOptions.find(option => option.value === props.model.level))
  const targetReady = computed(() => Boolean(props.model.targetId && props.model.property))
  const triggerReady = computed(() => Boolean(props.model.property && validCondition(props.model, selectedProperty.value)))
  const relieveReady = computed(() => triggerReady.value
    && validCondition(recoveryCondition(props.model), selectedProperty.value)
    && !validateAlarmConditions(props.model, selectedProperty.value))

  // 与保存入口保持相同的通道、接收人与自定义消息完整性口径；关闭通知不算缺少必填项。
  const notificationReady = computed(() => {
    const notification = props.model.notification
    return Boolean((notification.channelProviders.length || notification.notifyChannelIds?.length)
      && (notification.userIds.length || notification.dimensions?.length)
      && (props.model.source !== 'device' || !validateNotificationMessage(notification)))
  })
  const panelStates = computed<Record<EditorPanel, ConfigState>>(() => ({
    level: level.value ? 'complete' : 'pending',
    target: targetReady.value ? 'complete' : 'pending',
    trigger: triggerReady.value && (!props.model.autoRelieve || relieveReady.value) ? 'complete' : 'pending',
    notification: !props.model.notification.enabled ? 'off' : notificationReady.value ? 'complete' : 'pending',
  }))

  // 值未完整时不拼接带占位符的条件，避免把尚未配置的草稿误读为生效规则。
  const previewText = computed(() => triggerReady.value
    ? formatTriggerText(props.model, selectedProperty.value, t) : pending.value)
  const relievePreviewText = computed(() => relieveReady.value
    ? formatRelieveText(props.model, selectedProperty.value, t) : pending.value)
  const targetSummary = computed(() => [
    props.model.productName || props.productOption?.label || empty.value,
    props.model.source === 'device'
      ? props.model.targetName || props.deviceOption?.label || empty.value
      : t('DeviceAlarm.deviceRange.all'),
  ].join(' / '))
  const propertySummary = computed(() => props.model.propertyName || props.model.property || empty.value)
  const notificationSummary = computed(() => t(!props.model.notification.enabled
    ? 'DeviceAlarm.editor.off'
    : notificationReady.value ? 'DeviceAlarm.notification.configured' : 'DeviceAlarm.editor.pending'))

  const summaryItems = computed(() => [
    { key: 'level', panel: 'level' as const, labelKey: 'DeviceAlarm.form.level', value: level.value?.label || empty.value, state: panelStates.value.level },
    { key: 'target', panel: 'target' as const, labelKey: 'DeviceAlarm.editor.target', value: targetSummary.value,
      state: props.model.targetId ? 'complete' : 'pending' },
    { key: 'property', panel: 'target' as const, labelKey: 'DeviceAlarm.form.property', value: propertySummary.value,
      state: props.model.property ? 'complete' : 'pending' },
    { key: 'trigger', panel: 'trigger' as const, labelKey: 'DeviceAlarm.column.trigger', value: previewText.value,
      state: triggerReady.value ? 'complete' : 'pending' },
    { key: 'relieve', panel: 'trigger' as const, labelKey: 'DeviceAlarm.editor.relieve',
      value: props.model.autoRelieve ? relievePreviewText.value : t('DeviceAlarm.editor.off'),
      state: !props.model.autoRelieve ? 'off' : relieveReady.value ? 'complete' : 'pending' },
    { key: 'notification', panel: 'notification' as const, labelKey: 'DeviceAlarm.editor.notification',
      value: notificationSummary.value, state: panelStates.value.notification },
  ])

  function selectPanel(panel: EditorPanel) {
    if (!props.saving) activePanel.value = panel
  }

  return { panels, activePanel, activePanelMeta, panelStates, selectedProperty, previewText, relievePreviewText, summaryItems, selectPanel }
}
