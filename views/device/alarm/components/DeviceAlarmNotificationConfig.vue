<template>
  <span class="device-alarm-notify">
    <a-tooltip :title="$t(model.notification.enabled ? 'DeviceAlarm.notification.turnOff' : 'DeviceAlarm.notification.turnOn')" :trigger="['hover', 'focus']">
      <a-button type="text" size="small" class="notification-toggle" :class="{ 'is-off': !model.notification.enabled }"
        :disabled="disabled" :aria-pressed="model.notification.enabled" :aria-label="$t(model.notification.enabled ? 'DeviceAlarm.notification.turnOff' : 'DeviceAlarm.notification.turnOn')"
        @click="notification.toggleEnabled">
        <span class="notification-bell" aria-hidden="true"><AIcon :type="model.notification.enabled ? 'BellFilled' : 'BellOutlined'" /></span>
      </a-button>
    </a-tooltip>
    <span class="device-alarm-notify__sentence">
      <template v-if="model.notification.enabled">
        <span class="notification-clause">
          <span>{{ $t('DeviceAlarm.notification.using') }}</span>
          <a-popover :open="notification.activePanel === 'channels'" :trigger="['click']" placement="bottomLeft" :destroy-tooltip-on-hide="true" @open-change="notification.setPanel('channels', $event)">
            <template #content>
              <div class="notification-option-panel" @keydown.esc.stop.prevent="closeChannels">
                <a-alert v-if="failed" type="warning" show-icon :message="$t('PropertyRules.resourcesFailed')">
                  <template #action><a-button size="small" type="link" @click="$emit('request-methods')">{{ $t('PropertyRules.retry') }}</a-button></template>
                </a-alert>
                <a-spin :spinning="loading">
                  <a-checkbox-group v-model:value="notification.channelIds" class="notification-types" :disabled="disabled">
                    <div v-for="option in notification.channelOptions" :key="option.value" class="notification-type">
                      <a-checkbox :value="option.value"><RuleMenuOption compact :icon="option.icon" :title="option.label" :description="option.description" /></a-checkbox>
                      <DeviceAlarmTemplateStatus :templates="option.templates" :include-relieve="Boolean(model.autoRelieve && model.notification.includeRelieve)" />
                    </div>
                  </a-checkbox-group>
                  <span v-if="!loading && !notification.channelOptions.length" class="notification-types-empty">{{ $t('DeviceAlarm.notification.noTypes') }}</span>
                </a-spin>
                <div v-if="notification.channelOptions.length" class="notification-option-help">
                  <p v-if="notification.hasContactType">{{ $t('DeviceAlarm.delivery.contactSettings') }}</p>
                  <p>{{ $t('DeviceAlarm.delivery.templateOverride') }}</p>
                </div>
              </div>
            </template>
            <a-button ref="channelTrigger" type="text" size="small" class="notification-chip" :disabled="disabled" :aria-label="$t('DeviceAlarm.notification.type')" :aria-expanded="notification.activePanel === 'channels'" :title="notification.channelTitle">
              <AIcon :type="loading ? 'LoadingOutlined' : notification.selectedMethods[0]?.icon || 'SendOutlined'" :spin="loading" />
              <span class="notification-chip__label">{{ notification.channelLabel }}</span>
              <span v-if="notification.channelCount > 1 && notification.selectedMethods.length" class="notification-chip__count">+{{ notification.channelCount - 1 }}</span>
              <AIcon type="DownOutlined" class="notification-chip__arrow" />
            </a-button>
          </a-popover>
          <DeviceAlarmTemplateStatus v-if="notification.channelCount" :templates="selectedTemplateStatus" :include-relieve="Boolean(model.autoRelieve && model.notification.includeRelieve)" @open="$emit('request-methods')" />
        </span>
        <span class="notification-clause">
          <span>{{ $t('DeviceAlarm.notification.sendTo') }}</span>
          <DeviceAlarmRecipients v-model:value="model.notification.userIds" :scope-key="notification.scopeKey" :open="notification.activePanel === 'recipients'" :disabled="disabled" @update:open="notification.setPanel('recipients', $event)" />
        </span>
        <a-tooltip :title="$t(model.autoRelieve ? 'DeviceAlarm.notification.includeRelieveHint' : 'DeviceAlarm.notification.requireRelieve')">
          <a-checkbox class="notification-include-relieve" :checked="Boolean(model.autoRelieve && model.notification.includeRelieve)" :disabled="disabled || !model.autoRelieve" @update:checked="notification.setIncludeRelieve">{{ $t('DeviceAlarm.notification.includeRelieve') }}</a-checkbox>
        </a-tooltip>
      </template>
      <RuleNotice kind="info" :label="$t('DeviceAlarm.notification.help')" :message="$t('DeviceAlarm.notification.help')">
        <div class="notification-help">
          <section><strong>{{ $t('DeviceAlarm.delivery.whenTitle') }}</strong><p>{{ $t(model.notification.enabled ? 'DeviceAlarm.delivery.when' : 'DeviceAlarm.delivery.off') }}</p><p v-if="model.notification.enabled && model.autoRelieve && model.notification.includeRelieve">{{ $t('DeviceAlarm.delivery.recovery') }}</p></section>
          <section><strong>{{ $t('DeviceAlarm.delivery.missingTitle') }}</strong><p>{{ $t('DeviceAlarm.delivery.missing') }}</p><p class="notification-help-secondary">{{ $t('DeviceAlarm.delivery.statusLimit') }}</p></section>
        </div>
      </RuleNotice>
    </span>
    <DeviceAlarmMessageTemplateConfig v-if="model.notification.enabled && notification.showLegacyMessageTemplate" :model="model" :disabled="disabled" />
  </span>
</template>

<script setup lang="ts">
import { computed, reactive, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import DeviceAlarmMessageTemplateConfig from './DeviceAlarmMessageTemplateConfig.vue'
import DeviceAlarmRecipients from './DeviceAlarmRecipients.vue'
import DeviceAlarmTemplateStatus from './DeviceAlarmTemplateStatus.vue'
import RuleNotice from '../../components/PropertyRules/RuleNotice.vue'
import RuleMenuOption from '../../components/PropertyRules/RuleMenuOption.vue'
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
// Selected types share an overall status; legacy recovery rules still use their saved trigger template.
const selectedTemplateStatus = computed(() => {
  const legacy = props.model.notification.relieveTopicProvider === 'alarm-device'
  const statuses = notification.channelIds.map(id => props.methods.find(method => method.providerId === id)?.templates)
  const aggregate = (event: 'trigger' | 'relieve'): NonNullable<DeviceAlarmNotifyMethod['templates']>['trigger'] => {
    if (!statuses.length) return 'unknown'
    const values = statuses.map(status => status?.[legacy && event === 'relieve' ? 'trigger' : event] ?? 'unknown')
    return values.includes('unknown') ? 'unknown' : values.includes('missing') ? 'missing'
      : values.every(value => value === 'unneeded') ? 'unneeded' : 'ready'
  }
  return { trigger: aggregate('trigger'), relieve: aggregate('relieve') }
})
function closeChannels() {
  notification.setPanel('channels', false)
  channelTrigger.value?.focus()
}
</script>

<style scoped lang="less" src="./DeviceAlarmNotificationConfig.less"></style>
