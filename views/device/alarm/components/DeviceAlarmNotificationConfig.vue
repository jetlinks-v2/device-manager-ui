<template>
  <section class="device-alarm-notify">
    <header class="device-alarm-notify__head">
      <span class="device-alarm-notify__title"><AIcon :type="model.notification.enabled ? 'BellFilled' : 'BellOutlined'" />{{ $t('DeviceAlarm.notification.title') }}</span>
      <a-space size="small">
        <a-switch v-model:checked="model.notification.enabled" size="small" :disabled="disabled" :aria-label="$t('DeviceAlarm.notification.title')" />
        <a-button
          v-if="hasNotification"
          type="text"
          size="small"
          :disabled="disabled"
          :title="$t('DeviceAlarm.notification.clear')"
          :aria-label="$t('DeviceAlarm.notification.clear')"
          @click="clearNotification"
        >
          <AIcon type="ClearOutlined" />
        </a-button>
      </a-space>
    </header>

    <a-spin v-if="model.notification.enabled" :spinning="loading">
      <a-form-item>
        <template #label><AIcon type="SendOutlined" />{{ $t('DeviceAlarm.notification.channel') }}</template>
        <a-select
          v-model:value="selectedChannelIds"
          mode="multiple"
          :options="methodOptions"
          :placeholder="$t('DeviceAlarm.notification.channelPlaceholder')"
          size="small"
          :max-tag-count="'responsive'"
          :aria-label="$t('DeviceAlarm.notification.channel')"
          :disabled="disabled"
          @change="syncParameters"
        />
      </a-form-item>

      <a-form-item>
        <template #label><AIcon type="TeamOutlined" />{{ $t('DeviceAlarm.notification.user') }}</template>
        <DeviceAlarmRecipients v-model:value="model.notification.userIds" :scope-key="`${model.source}:${model.targetId}:${model.property}`" :disabled="disabled" />
      </a-form-item>

      <DeviceAlarmMessageTemplateConfig
        v-if="showLegacyMessageTemplate"
        :model="model"
        :disabled="disabled"
      />
    </a-spin>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue'
import DeviceAlarmMessageTemplateConfig from './DeviceAlarmMessageTemplateConfig.vue'
import DeviceAlarmRecipients from './DeviceAlarmRecipients.vue'
import { getNotificationMessageMode, matchesAlarmNotifyMethod } from '../utils'
import type {
  DeviceAlarmFormModel,
  DeviceAlarmNotifyMethod,
} from '../types'

const props = defineProps({
  model: { type: Object as PropType<DeviceAlarmFormModel>, required: true },
  methods: { type: Array as PropType<DeviceAlarmNotifyMethod[]>, default: () => [] },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const hasNotification = computed(() =>
  Boolean(props.model.notification.notifyChannelIds?.length || props.model.notification.channelProviders.length || props.model.notification.userIds.length),
)

const showLegacyMessageTemplate = ref(false)

watch(
  () => props.model,
  (model) => {
    // 自定义内容只对打开时已有自定义模板的存量规则保留；会话内切回默认后仍可撤销。
    showLegacyMessageTemplate.value = model.source === 'device'
      && getNotificationMessageMode(model.notification) === 'custom'
  },
  { immediate: true },
)

const selectedMethods = computed(() => {
  return props.methods.filter(method => matchesAlarmNotifyMethod(props.model.notification, method))
})

const selectedChannelIds = computed({
  get() {
    return selectedMethods.value.map((method) => method.channelId || method.id).filter(Boolean)
  },
  set(value: string[]) {
    const selected = new Set(value)
    const methods = props.methods.filter((method) => selected.has(method.channelId || method.id))
    props.model.notification.notifyChannelIds = methods
      .map((method) => method.channelId)
      .filter((id): id is string => Boolean(id))
    props.model.notification.channelProviders = Array.from(new Set(methods.map((method) => method.providerId).filter(Boolean)))
  },
})

const methodOptions = computed(() =>
  props.methods.map((method) => ({
    label: method.label,
    value: method.channelId || method.id,
  })),
)

watch(
  selectedMethods,
  (methods) => {
    // Saved channel IDs remain authoritative while options load or a channel becomes unavailable.
    if (props.model.notification.notifyChannelIds?.length || !props.methods.length) return
    const channelIds = methods.map((method) => method.channelId).filter((id): id is string => Boolean(id))
    if (!sameStringArray(props.model.notification.notifyChannelIds ?? [], channelIds)) {
      props.model.notification.notifyChannelIds = channelIds
    }
  },
  { immediate: true },
)

function clearNotification() {
  props.model.notification.channelProviders = []
  props.model.notification.notifyChannelIds = []
  props.model.notification.userIds = []
  props.model.notification.parameters = {}
  props.model.notification.enabled = false
}

function syncParameters() {
  const parameters: Record<string, unknown> = {}
  selectedMethods.value.forEach((method) => {
    const raw = method.raw ?? {}
    const configuration = raw.channelConfiguration ?? raw.configuration ?? {}
    parameters[method.providerId] = {
      templateId: firstText(configuration.templateId, raw.templateId),
      notifierId: firstText(configuration.notifierId, raw.notifierId),
    }
  })
  // 通道参数会随选择结果重建，但设备告警消息模板属于通知根配置，切换通道时必须保留。
  const currentParameters = props.model.notification.parameters ?? {}
  const messageParameterKeys = ['template', 'messageTemplate', 'variableDefinitions']
  messageParameterKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(currentParameters, key)) {
      parameters[key] = currentParameters[key]
    }
  })
  props.model.notification.parameters = parameters
}

function firstText(...values: unknown[]) {
  return values.map((value) => {
    if (value == null) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return ''
  }).find(Boolean) || ''
}

function sameStringArray(left: string[], right: string[]) {
  if (left.length !== right.length) return false
  return left.every((item, index) => item === right[index])
}
</script>

<style scoped lang="less" src="./DeviceAlarmNotificationConfig.less"></style>
