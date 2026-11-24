<template>
  <span class="device-alarm-notify" :class="{ 'device-alarm-notify--form': layout === 'form' }">
    <span v-if="layout !== 'form'" class="notification-heading">
      <a-tooltip :title="$t(model.notification.enabled ? 'DeviceAlarm.notification.turnOff' : 'DeviceAlarm.notification.turnOn')" :trigger="['hover', 'focus']">
        <a-button type="text" size="small" class="notification-toggle" :class="{ 'is-off': !model.notification.enabled }"
          :disabled="disabled" :aria-pressed="model.notification.enabled" :aria-label="$t(model.notification.enabled ? 'DeviceAlarm.notification.turnOff' : 'DeviceAlarm.notification.turnOn')"
          @click="notification.toggleEnabled">
          <span class="notification-bell" aria-hidden="true"><AIcon :type="model.notification.enabled ? 'BellFilled' : 'BellOutlined'" /></span>
        </a-button>
      </a-tooltip>
      <span>{{ $t('DeviceAlarm.notification.short') }}</span>
      <DeviceAlarmNotificationHelp :model="model" />
    </span>
    <span class="device-alarm-notify__sentence">
      <template v-if="layout === 'form' || model.notification.enabled">
        <DeviceAlarmNotificationBlocks :model="model" :methods="methods" :disabled="disabled" :loading="loading" :failed="failed"
          :compact="layout === 'inline'" :reveal="layout === 'inline' && reveal" :reveal-channel="revealChannel" :can-configure="canConfigure"
          @configure="configureTemplate" @refresh="$emit('request-methods')" @open-change="$emit('open-change', $event)">
          <template #footer>
            <span class="notification-relieve">
              <a-tooltip :title="layout === 'form' ? undefined : $t(model.autoRelieve ? 'DeviceAlarm.notification.includeRelieveHint' : 'DeviceAlarm.notification.requireRelieve')" :trigger="['hover', 'focus']" placement="topLeft">
                <a-checkbox class="notification-include-relieve" :checked="Boolean(model.autoRelieve && model.notification.includeRelieve)" :disabled="disabled || !model.autoRelieve" @update:checked="notification.setIncludeRelieve">{{ $t('DeviceAlarm.notification.includeRelieve') }}</a-checkbox>
              </a-tooltip>
              <span v-if="layout === 'form'" class="notification-relieve__hint">{{ $t(model.autoRelieve ? 'DeviceAlarm.notification.includeRelieveHint' : 'DeviceAlarm.notification.requireRelieve') }}</span>
            </span>
          </template>
        </DeviceAlarmNotificationBlocks>
        <a-alert v-if="failed" type="error" show-icon :message="$t('PropertyRules.resourcesFailed')">
          <template #action><a-button size="small" type="link" @click="$emit('retry-methods')">{{ $t('PropertyRules.retry') }}</a-button></template>
        </a-alert>
        <a-alert v-else-if="!loading && !methods.length" type="info" show-icon :message="$t('DeviceAlarm.notification.noTypes')" />
      </template>
    </span>
    <DeviceAlarmMessageTemplateConfig v-if="model.notification.enabled && notification.showLegacyMessageTemplate" :model="model" :disabled="disabled" />
  </span>
</template>

<script setup lang="ts">
import { reactive, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import DeviceAlarmMessageTemplateConfig from './DeviceAlarmMessageTemplateConfig.vue'
import DeviceAlarmNotificationHelp from './editor/DeviceAlarmNotificationHelp.vue'
import DeviceAlarmNotificationBlocks from './DeviceAlarmNotificationBlocks.vue'
import { useNotificationConfigNavigation } from '@jetlinks-web-core/hooks/useNotificationConfigNavigation'
import { useAlarmNotification } from '../hooks/useAlarmNotification'
import type { DeviceAlarmFormModel, DeviceAlarmNotifyMethod } from '../types'

const props = defineProps({
  model: { type: Object as PropType<DeviceAlarmFormModel>, required: true },
  methods: { type: Array as PropType<DeviceAlarmNotifyMethod[]>, default: () => [] },
  loading: { type: Boolean, default: false },
  failed: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  reveal: { type: Boolean, default: undefined },
  revealChannel: { type: String, default: undefined },
  // The editor uses labelled rows; property rule sentences keep the compact default.
  layout: { type: String as PropType<'inline' | 'form'>, default: 'inline' },
})
const emit = defineEmits<{ (e: 'request-methods'): void; (e: 'retry-methods'): void; (e: 'open-change', value: boolean): void; (e: 'update:selected-channel', value: string | undefined): void }>()
const { t: $t } = useI18n()
const notification = reactive(useAlarmNotification(props, () => emit('request-methods'), value => emit('open-change', value), true))
const { available: canConfigure, open: openConfiguration } = useNotificationConfigNavigation(() => emit('retry-methods'))
watch(() => notification.selectedChannelId, id => { if (props.layout !== 'form') emit('update:selected-channel', id) })
function configureTemplate(topic: 'alarm-device' | 'alarm-device-relieve', id?: string) {
  const method = props.methods.find(method => method.id === id)
  const fixed = method?.fixedReceiver
  const templateId = topic === 'alarm-device-relieve' ? fixed?.relieveTemplateId : fixed?.templateId
  openConfiguration(topic, method?.providerId ?? (id?.startsWith('@channels:') ? undefined : id), templateId ? { templateId } : {})
}
</script>

<style scoped lang="less" src="./DeviceAlarmNotificationConfig.less"></style>
