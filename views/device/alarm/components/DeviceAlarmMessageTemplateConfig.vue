<template>
  <section class="device-alarm-message">
    <a-form-item :label="$t('DeviceAlarm.notification.messageMode')">
      <a-radio-group
        v-model:value="messageMode"
        :options="messageModeOptions"
        :disabled="disabled"
      />
    </a-form-item>

    <template v-if="messageMode === 'custom'">
      <p class="device-alarm-message__scope">
        {{ $t('DeviceAlarm.notification.messageScope') }}
      </p>
      <a-textarea
        ref="textareaRef"
        v-model:value="messageTemplate"
        :rows="4"
        :maxlength="messageMaxLength"
        :placeholder="$t('DeviceAlarm.notification.messagePlaceholder')"
        :disabled="disabled"
        show-count
      />

      <div class="device-alarm-message__variables">
        <span>{{ $t('DeviceAlarm.notification.messageVariables') }}</span>
        <div class="device-alarm-message__variable-list">
          <button
            v-for="variable in variables"
            :key="variable.id"
            type="button"
            :disabled="disabled"
            @click="insertVariable(variable.id)"
          >
            {{ $t(variable.labelKey) }}
            <code>{{ variableToken(variable.id) }}</code>
          </button>
        </div>
      </div>

      <div class="device-alarm-message__preview">
        <span>{{ $t('DeviceAlarm.notification.messagePreview') }}</span>
        <p>{{ previewText || $t('DeviceAlarm.notification.messagePreviewEmpty') }}</p>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DeviceAlarmFormModel } from '../types'
import {
  clearNotificationMessageTemplate,
  DEVICE_ALARM_NOTIFICATION_MESSAGE_MAX_LENGTH,
  getNotificationMessageMode,
  getNotificationMessageTemplate,
  setNotificationMessageTemplate,
  type DeviceAlarmNotificationMessageMode,
} from '../utils'

const props = defineProps({
  model: { type: Object as PropType<DeviceAlarmFormModel>, required: true },
  disabled: { type: Boolean, default: false },
})

const { t: $t } = useI18n()
const textareaRef = ref<{ resizableTextArea?: { textArea?: HTMLTextAreaElement } }>()
const messageMaxLength = DEVICE_ALARM_NOTIFICATION_MESSAGE_MAX_LENGTH
const variables = [
  { id: 'targetName', labelKey: 'DeviceAlarm.notification.variable.targetName' },
  { id: 'alarmConfigName', labelKey: 'DeviceAlarm.notification.variable.alarmConfigName' },
  { id: 'propertyName', labelKey: 'DeviceAlarm.notification.variable.propertyName' },
  { id: 'propertyValue', labelKey: 'DeviceAlarm.notification.variable.propertyValue' },
  { id: 'level', labelKey: 'DeviceAlarm.notification.variable.level' },
  { id: 'alarmTime', labelKey: 'DeviceAlarm.notification.variable.alarmTime' },
]

const messageModeOptions = computed(() => [
  { label: $t('DeviceAlarm.notification.messageModeDefault'), value: 'default' },
  { label: $t('DeviceAlarm.notification.messageModeCustom'), value: 'custom' },
])

const messageMode = computed<DeviceAlarmNotificationMessageMode>({
  get: () => getNotificationMessageMode(props.model.notification),
  set: (mode) => {
    if (mode === 'default') {
      clearNotificationMessageTemplate(props.model.notification)
      return
    }
    const current = getNotificationMessageTemplate(props.model.notification)
    setNotificationMessageTemplate(
      props.model.notification,
      current || $t('DeviceAlarm.notification.messageDefaultTemplate'),
    )
  },
})

const messageTemplate = computed({
  get: () => getNotificationMessageTemplate(props.model.notification),
  set: (value: string) => setNotificationMessageTemplate(props.model.notification, value),
})

const previewText = computed(() => renderPreview(messageTemplate.value))

function insertVariable(id: string) {
  const token = variableToken(id)
  const current = messageTemplate.value
  const textarea = textareaRef.value?.resizableTextArea?.textArea
  if (!textarea) {
    messageTemplate.value = `${current}${token}`
    return
  }
  const start = textarea.selectionStart ?? current.length
  const end = textarea.selectionEnd ?? start
  messageTemplate.value = `${current.slice(0, start)}${token}${current.slice(end)}`
  void nextTick(() => {
    textarea.focus()
    textarea.selectionStart = start + token.length
    textarea.selectionEnd = start + token.length
  })
}

function variableToken(id: string) {
  return `\${${id}}`
}

function renderPreview(template: string) {
  const values: Record<string, string> = {
    targetName: props.model.targetName || props.model.deviceId || $t('DeviceAlarm.notification.preview.targetName'),
    alarmConfigName: props.model.name || $t('DeviceAlarm.notification.preview.alarmConfigName'),
    propertyName: props.model.propertyName || props.model.property || $t('DeviceAlarm.notification.preview.propertyName'),
    propertyValue: $t('DeviceAlarm.notification.preview.propertyValue'),
    level: $t(`DeviceAlarm.level.${levelKey(props.model.level)}`),
    alarmTime: new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(new Date()),
  }
  return template.replace(/\$\{([^}]+)}/g, (token, id: string) => values[id] ?? token)
}

function levelKey(level: number) {
  return ['emergency', 'urgent', 'severity', 'ordinary', 'warn'][level - 1] ?? 'ordinary'
}
</script>

<style scoped lang="less" src="./DeviceAlarmMessageTemplateConfig.less"></style>
