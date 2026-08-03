<template>
  <section class="device-alarm-notify">
    <header class="device-alarm-notify__head">
      <h4>{{ $t('DeviceAlarm.notification.title') }}</h4>
      <a-space>
        <span class="device-alarm-notify__switch-label">
          {{ model.notification.enabled ? $t('DeviceAlarm.notification.enabled') : $t('DeviceAlarm.notification.disabled') }}
        </span>
        <a-switch v-model:checked="model.notification.enabled" />
        <a-button
          v-if="hasNotification"
          type="link"
          size="small"
          @click="clearNotification"
        >
          {{ $t('DeviceAlarm.notification.clear') }}
        </a-button>
      </a-space>
    </header>

    <a-spin :spinning="loading">
      <a-form-item :label="$t('DeviceAlarm.notification.channel')">
        <a-select
          v-model:value="selectedChannelIds"
          mode="multiple"
          :options="methodOptions"
          :placeholder="$t('DeviceAlarm.notification.channelPlaceholder')"
          :disabled="!model.notification.enabled"
          @change="syncParameters"
        />
      </a-form-item>

      <a-form-item :label="$t('DeviceAlarm.notification.user')">
        <a-select
          v-model:value="model.notification.userIds"
          mode="multiple"
          show-search
          :filter-option="filterUserOption"
          :options="userOptions"
          :placeholder="$t('DeviceAlarm.notification.userPlaceholder')"
          :disabled="!model.notification.enabled"
          @popupScroll="handleUserPopupScroll"
        />
      </a-form-item>

      <DeviceAlarmMessageTemplateConfig
        v-if="model.source === 'device'"
        :model="model"
        :disabled="!model.notification.enabled"
      />
    </a-spin>
  </section>
</template>

<script setup lang="ts">
import { computed, watch, type PropType } from 'vue'
import DeviceAlarmMessageTemplateConfig from './DeviceAlarmMessageTemplateConfig.vue'
import type {
  DeviceAlarmFormModel,
  DeviceAlarmNotifyMethod,
  DeviceAlarmNotifyUser,
} from '../types'

const props = defineProps({
  model: { type: Object as PropType<DeviceAlarmFormModel>, required: true },
  methods: { type: Array as PropType<DeviceAlarmNotifyMethod[]>, default: () => [] },
  users: { type: Array as PropType<DeviceAlarmNotifyUser[]>, default: () => [] },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits<{
  'load-more-users': []
}>()

const hasNotification = computed(() =>
  Boolean(props.model.notification.notifyChannelIds?.length || props.model.notification.channelProviders.length || props.model.notification.userIds.length),
)

const selectedMethods = computed(() => {
  const selectedChannelIds = new Set(props.model.notification.notifyChannelIds ?? [])
  const selectedProviders = new Set(props.model.notification.channelProviders)
  return props.methods.filter((method) => {
    const channelId = method.channelId || method.id
    if (channelId && selectedChannelIds.has(channelId)) return true
    if (!selectedProviders.has(method.providerId)) return false
    return matchesConfiguredParameter(method)
  })
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
      .filter(Boolean)
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
    const channelIds = methods.map((method) => method.channelId).filter(Boolean)
    if (!sameStringArray(props.model.notification.notifyChannelIds ?? [], channelIds)) {
      props.model.notification.notifyChannelIds = channelIds
    }
  },
  { immediate: true },
)

const userOptions = computed(() =>
  props.users.map((user) => ({
    label: `${user.name}${user.desc ? `（${user.desc}）` : ''}`,
    value: user.id,
  })),
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

function matchesConfiguredParameter(method: DeviceAlarmNotifyMethod) {
  const parameter = props.model.notification.parameters?.[method.providerId]
  if (!isRecord(parameter)) return true
  const raw = method.raw ?? {}
  const configuration = raw.channelConfiguration ?? raw.configuration ?? {}
  const configuredNotifierId = firstText(parameter.notifierId)
  const configuredTemplateId = firstText(parameter.templateId)
  if (configuredNotifierId && configuredNotifierId !== firstText(configuration.notifierId, raw.notifierId)) return false
  if (configuredTemplateId && configuredTemplateId !== firstText(configuration.templateId, raw.templateId)) return false
  return true
}

function filterUserOption(input: string, option?: { label?: string }) {
  return String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
}

function handleUserPopupScroll(event: Event) {
  const target = event.target as HTMLElement
  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 24) {
    emit('load-more-users')
  }
}

function firstText(...values: unknown[]) {
  return values.map((value) => {
    if (value == null) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return ''
  }).find(Boolean) || ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function sameStringArray(left: string[], right: string[]) {
  if (left.length !== right.length) return false
  return left.every((item, index) => item === right[index])
}
</script>

<style scoped lang="less" src="./DeviceAlarmNotificationConfig.less"></style>
