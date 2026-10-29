<template>
  <span class="device-alarm-notify">
    <span class="device-alarm-notify__sentence">
      <a-button type="text" size="small" class="notification-toggle" :class="{ 'is-off': !model.notification.enabled }"
        :disabled="disabled" :aria-pressed="model.notification.enabled" :aria-label="$t(model.notification.enabled ? 'DeviceAlarm.notification.turnOff' : 'DeviceAlarm.notification.turnOn')"
        :title="$t(model.notification.enabled ? 'DeviceAlarm.notification.turnOff' : 'DeviceAlarm.notification.turnOn')" @click="notification.toggleEnabled">
        <AIcon :type="model.notification.enabled ? 'BellFilled' : 'BellOutlined'" />
        <span v-if="!model.notification.enabled">{{ $t('DeviceAlarm.notification.short') }}</span>
      </a-button>
      <template v-if="model.notification.enabled">
        <span class="notification-clause">
          <span>{{ $t('DeviceAlarm.notification.using') }}</span>
          <a-popover :open="notification.activePanel === 'channels'" :trigger="['click']" placement="bottomLeft" :destroy-tooltip-on-hide="true" @open-change="notification.setPanel('channels', $event)">
            <template #content>
              <div class="notification-option-panel" @keydown.esc.stop.prevent="closeChannels">
                <a-alert v-if="failed" type="warning" show-icon :message="$t('PropertyRules.resourcesFailed')">
                  <template #action><a-button size="small" type="link" @click="$emit('request-methods')">{{ $t('PropertyRules.retry') }}</a-button></template>
                </a-alert>
                <a-spin :spinning="loading"><ConditionOptionPanel v-if="notification.activePanel === 'channels'" v-model:value="notification.channelIds" :options="notification.channelOptions" :config="channelPanelConfig" /></a-spin>
              </div>
            </template>
            <a-button ref="channelTrigger" type="text" size="small" class="notification-chip" :disabled="disabled" :aria-label="$t('DeviceAlarm.notification.channel')" :aria-expanded="notification.activePanel === 'channels'" :title="notification.channelTitle">
              <AIcon :type="loading ? 'LoadingOutlined' : notification.selectedMethods[0]?.icon || 'SendOutlined'" :spin="loading" />
              <span class="notification-chip__label">{{ notification.channelLabel }}</span>
              <span v-if="notification.channelCount > 1 && notification.selectedMethods.length" class="notification-chip__count">+{{ notification.channelCount - 1 }}</span>
              <AIcon type="DownOutlined" class="notification-chip__arrow" />
            </a-button>
          </a-popover>
        </span>
        <span class="notification-clause">
          <span>{{ $t('DeviceAlarm.notification.sendTo') }}</span>
          <DeviceAlarmRecipients v-model:value="model.notification.userIds" :scope-key="notification.scopeKey" :open="notification.activePanel === 'recipients'" :disabled="disabled" @update:open="notification.setPanel('recipients', $event)" />
        </span>
      </template>
    </span>
    <DeviceAlarmMessageTemplateConfig v-if="model.notification.enabled && notification.showLegacyMessageTemplate" :model="model" :disabled="disabled" />
  </span>
</template>

<script setup lang="ts">
import { computed, reactive, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { ConditionOptionPanel } from '@jetlinks-web-core/components/ConditionFilter'
import DeviceAlarmMessageTemplateConfig from './DeviceAlarmMessageTemplateConfig.vue'
import DeviceAlarmRecipients from './DeviceAlarmRecipients.vue'
import { useAlarmNotification } from '../hooks/useAlarmNotification'
import type { DeviceAlarmFormModel, DeviceAlarmNotifyMethod } from '../types'

const props = defineProps({
  model: { type: Object as PropType<DeviceAlarmFormModel>, required: true },
  methods: { type: Array as PropType<DeviceAlarmNotifyMethod[]>, default: () => [] },
  loading: { type: Boolean, default: false },
  failed: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  reveal: { type: Boolean, default: undefined },
})
const emit = defineEmits<{ (e: 'request-methods'): void; (e: 'open-change', value: boolean): void }>()
const { t: $t } = useI18n()
const notification = reactive(useAlarmNotification(props, () => emit('request-methods'), value => emit('open-change', value)))
const channelTrigger = ref<{ focus: () => void }>()
const channelPanelConfig = computed(() => ({ multiple: true, showCheckAll: false, keywordPlaceholder: $t('DeviceAlarm.notification.channelPlaceholder') }))
function closeChannels() {
  notification.setPanel('channels', false)
  channelTrigger.value?.focus()
}
</script>

<style scoped lang="less" src="./DeviceAlarmNotificationConfig.less"></style>
