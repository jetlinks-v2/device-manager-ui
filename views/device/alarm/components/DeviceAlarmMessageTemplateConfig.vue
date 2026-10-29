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
        <div class="device-alarm-message__preview-heading">
          <span>{{ $t('DeviceAlarm.notification.messagePreview') }}</span>
          <a-radio-group
            v-if="model.autoRelieve"
            v-model:value="previewEvent"
            size="small"
            :options="previewEvents"
            :aria-label="$t('DeviceAlarm.notification.preview.event')"
            option-type="button"
          />
        </div>
        <p>{{ previewText || $t('DeviceAlarm.notification.messagePreviewEmpty') }}</p>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DeviceAlarmFormModel } from '../types'
import { createDefaultNotificationMessageTemplate, notificationMessageVariables, renderNotificationMessagePreview } from '../notificationMessageVariables'
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
const variables = notificationMessageVariables
const previewEvent = ref<'trigger' | 'relieve'>('trigger')
const previewEvents = computed(() => ['trigger', 'relieve'].map(value => ({ value, label: $t(`DeviceAlarm.notification.preview.${value}`) })))

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
      current || createDefaultNotificationMessageTemplate($t),
    )
  },
})

const messageTemplate = computed({
  get: () => getNotificationMessageTemplate(props.model.notification),
  set: (value: string) => setNotificationMessageTemplate(props.model.notification, value),
})

const previewText = computed(() => renderNotificationMessagePreview(messageTemplate.value, props.model, $t, props.model.autoRelieve ? previewEvent.value : 'trigger'))

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

</script>

<style scoped lang="less" src="./DeviceAlarmMessageTemplateConfig.less"></style>
