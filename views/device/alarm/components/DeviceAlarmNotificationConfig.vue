<template>
  <span class="device-alarm-notify" :class="{ 'device-alarm-notify--form': layout === 'form' }">
    <span v-if="layout === 'form'" class="notification-enable">
      <span>{{ $t('DeviceAlarm.notification.turnOn') }}</span>
      <a-switch :checked="model.notification.enabled" :disabled="disabled" :aria-label="$t('DeviceAlarm.notification.turnOn')" @change="notification.toggleEnabled" />
    </span>
    <a-tooltip v-if="layout !== 'form'" :title="$t(model.notification.enabled ? 'DeviceAlarm.notification.turnOff' : 'DeviceAlarm.notification.turnOn')" :trigger="['hover', 'focus']">
      <a-button type="text" size="small" class="notification-toggle" :class="{ 'is-off': !model.notification.enabled }"
        :disabled="disabled" :aria-pressed="model.notification.enabled" :aria-label="$t(model.notification.enabled ? 'DeviceAlarm.notification.turnOff' : 'DeviceAlarm.notification.turnOn')"
        @click="notification.toggleEnabled">
        <span class="notification-bell" aria-hidden="true"><AIcon :type="model.notification.enabled ? 'BellFilled' : 'BellOutlined'" /></span>
      </a-button>
    </a-tooltip>
    <span class="device-alarm-notify__sentence">
      <template v-if="model.notification.enabled">
        <span class="notification-clause">
          <span>{{ $t(layout === 'form' ? 'DeviceAlarm.notification.type' : 'DeviceAlarm.notification.using') }}</span>
          <a-popover :open="notification.activePanel === 'channels'" :trigger="['click']" placement="bottomLeft" :destroy-tooltip-on-hide="true" @open-change="notification.setPanel('channels', $event)">
            <template #content>
              <div class="notification-option-panel" @keydown.esc.stop.prevent="closeChannels">
                <a-alert v-if="failed" type="warning" show-icon :message="$t('PropertyRules.resourcesFailed')">
                  <template #action><a-button size="small" type="link" @click="$emit('retry-methods')">{{ $t('PropertyRules.retry') }}</a-button></template>
                </a-alert>
                <a-spin :spinning="loading">
                  <a-checkbox-group v-model:value="notification.channelIds" class="notification-types" :disabled="disabled">
                    <div v-for="option in notification.channelOptions" :key="option.value" class="notification-type">
                      <a-checkbox :value="option.value"><RuleMenuOption compact :icon="option.icon" :title="option.label" :description="option.description" /></a-checkbox>
                      <DeviceAlarmTemplateStatus :templates="option.templates" :include-relieve="Boolean(model.autoRelieve && model.notification.includeRelieve)" />
                      <a-button v-if="canConfigure && option.value !== 'inside-mail'" size="small" type="link" @click="openConfiguration('alarm-device', option.value)">{{ $t('DeviceAlarm.notification.configureTemplate') }}</a-button>
                      <a-button v-if="canConfigure && option.value !== 'inside-mail' && model.autoRelieve && model.notification.includeRelieve && model.notification.relieveTopicProvider !== 'alarm-device'" size="small" type="link" @click="openConfiguration('alarm-device-relieve', option.value)">{{ $t('DeviceAlarm.notification.configureRelieveTemplate') }}</a-button>
                    </div>
                  </a-checkbox-group>
                  <span v-if="!loading && !failed && !notification.channelOptions.length" class="notification-types-empty">{{ $t('DeviceAlarm.notification.noTypes') }}</span>
                </a-spin>
                <a-button v-if="canConfigure" type="link" @click="openConfiguration('alarm-device')">{{ $t('DeviceAlarm.notification.configureTemplate') }}</a-button>
                <div v-if="notification.channelOptions.length" class="notification-option-help">
                  <p v-if="notification.hasContactType">{{ $t('DeviceAlarm.delivery.contactSettings') }}</p>
                  <p>{{ $t('DeviceAlarm.delivery.templateOverride') }}</p>
                </div>
              </div>
            </template>
            <a-button ref="channelTrigger" type="text" :size="layout === 'form' ? 'middle' : 'small'" class="notification-chip" :disabled="disabled" :aria-label="$t('DeviceAlarm.notification.type')" :aria-expanded="notification.activePanel === 'channels'" :title="notification.channelTitle">
              <AIcon :type="loading ? 'LoadingOutlined' : notification.selectedMethods[0]?.icon || 'SendOutlined'" :spin="loading" />
              <DeviceAlarmSelectionSummary :labels="notification.channelLabels" :placeholder="notification.channelLabel" />
              <AIcon type="DownOutlined" class="notification-chip__arrow" />
            </a-button>
          </a-popover>
          <DeviceAlarmTemplateStatus v-if="notification.channelCount" :templates="notification.selectedTemplateStatus" :include-relieve="Boolean(model.autoRelieve && model.notification.includeRelieve)" @open="$emit('request-methods')" />
        </span>
        <span v-if="notification.channelCount" class="notification-clause">
          <span>{{ $t(layout === 'form' ? 'DeviceAlarm.notification.user' : 'DeviceAlarm.notification.sendTo') }}</span>
          <DeviceAlarmRecipients v-model:value="model.notification.userIds" :scope-key="notification.scopeKey" :open="notification.activePanel === 'recipients'" :disabled="disabled" @update:open="notification.setPanel('recipients', $event)" />
        </span>
        <a-tooltip :title="$t(model.autoRelieve ? 'DeviceAlarm.notification.includeRelieveHint' : 'DeviceAlarm.notification.requireRelieve')">
          <a-checkbox class="notification-include-relieve" :checked="Boolean(model.autoRelieve && model.notification.includeRelieve)" :disabled="disabled || !model.autoRelieve" @update:checked="notification.setIncludeRelieve">{{ $t('DeviceAlarm.notification.includeRelieve') }}</a-checkbox>
        </a-tooltip>
      </template>
      <DeviceAlarmNotificationHelp v-if="layout !== 'form'" :model="model" />
    </span>
    <DeviceAlarmMessageTemplateConfig v-if="model.notification.enabled && notification.showLegacyMessageTemplate" :model="model" :disabled="disabled" />
  </span>
</template>

<script setup lang="ts">
import { reactive, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import DeviceAlarmMessageTemplateConfig from './DeviceAlarmMessageTemplateConfig.vue'
import DeviceAlarmRecipients from './DeviceAlarmRecipients.vue'
import DeviceAlarmTemplateStatus from './DeviceAlarmTemplateStatus.vue'
import DeviceAlarmNotificationHelp from './editor/DeviceAlarmNotificationHelp.vue'
import DeviceAlarmSelectionSummary from './DeviceAlarmSelectionSummary.vue'
import RuleMenuOption from '../../components/PropertyRules/RuleMenuOption.vue'
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
  // The editor uses labelled rows; property rule sentences keep the compact default.
  layout: { type: String as PropType<'inline' | 'form'>, default: 'inline' },
})
const emit = defineEmits<{ (e: 'request-methods'): void; (e: 'retry-methods'): void; (e: 'open-change', value: boolean): void }>()
const { t: $t } = useI18n()
const notification = reactive(useAlarmNotification(props, () => emit('request-methods'), value => emit('open-change', value)))
const { available: canConfigure, open: openConfiguration } = useNotificationConfigNavigation(() => emit('retry-methods'))
const channelTrigger = ref<{ focus: () => void }>()
function closeChannels() {
  notification.setPanel('channels', false)
  channelTrigger.value?.focus()
}
</script>

<style scoped lang="less" src="./DeviceAlarmNotificationConfig.less"></style>
