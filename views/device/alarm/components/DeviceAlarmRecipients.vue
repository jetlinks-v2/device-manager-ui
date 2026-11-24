<template>
  <a-popover :open="directory.open" :trigger="['click']" placement="bottomLeft" :destroy-tooltip-on-hide="true" @open-change="$emit('update:open', $event)">
    <template #content>
      <div class="notification-option-panel notification-recipient-panel" @keydown.esc.stop.prevent="closePanel">
        <a-alert v-if="directory.candidateFailed || directory.selectedFailed" type="warning" show-icon :message="$t('DeviceAlarm.notification.usersFailed')">
          <template #action><a-button type="link" size="small" @click="directory.retry">{{ $t('PropertyRules.retry') }}</a-button></template>
        </a-alert>
        <ConditionOptionPanel v-if="directory.open" :key="directory.revision" :value="value" :config="directory.config" :options="directory.options" @update:value="$emit('update:value', $event)" />
      </div>
    </template>
    <a-button ref="trigger" type="text" size="small" class="notification-chip" :disabled="disabled" :aria-label="$t('DeviceAlarm.notification.user')" :aria-expanded="directory.open" :title="directory.selectionTitle">
      <AIcon :type="directory.selectedLoading ? 'LoadingOutlined' : directory.selectedFailed ? 'ExclamationCircleOutlined' : 'TeamOutlined'" :spin="directory.selectedLoading" />
      <span v-if="compact" class="notification-recipient-count">{{ value.length ? $t('DeviceAlarm.notification.selectedCount', { count: value.length }) : $t('DeviceAlarm.notification.selectUsers') }}</span>
      <SelectionSummary v-else-if="layout === 'form'" :names="directory.selectionLabels" :placeholder="directory.selectionLabel" />
      <DeviceAlarmSelectionSummary v-else :labels="directory.selectionLabels" :placeholder="directory.selectionLabel" />
      <AIcon type="DownOutlined" class="notification-chip__arrow" />
    </a-button>
  </a-popover>
</template>
<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ConditionOptionPanel } from '@jetlinks-web-core/components/ConditionFilter'
import SelectionSummary from '@jetlinks-web-core/components/SelectionSummary'
import { useAlarmRecipients } from '../hooks/useAlarmRecipients'
import DeviceAlarmSelectionSummary from './DeviceAlarmSelectionSummary.vue'
const props = withDefaults(defineProps<{ value: string[]; scopeKey: string; open: boolean; disabled?: boolean; layout?: 'inline' | 'form'; compact?: boolean }>(), { layout: 'inline', compact: false })
const emit = defineEmits<{ (e: 'update:value', value: string[]): void; (e: 'update:open', value: boolean): void }>()
const { t: $t } = useI18n()
const directory = reactive(useAlarmRecipients(props))
const trigger = ref<{ focus: () => void }>()
function closePanel() {
  emit('update:open', false)
  trigger.value?.focus()
}
</script>
<style scoped lang="less" src="./DeviceAlarmNotificationConfig.less"></style>
<style scoped>
.notification-recipient-panel :deep(.condition-option-panel__content) { flex-direction: row; align-items: center; justify-content: space-between; gap: var(--space-3); }
.notification-recipient-panel :deep(.condition-option-panel__label) { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.notification-recipient-panel :deep(.condition-option-panel__description) { flex: 0 1 50%; min-width: 0; margin-inline-start: auto; text-align: end; color: var(--ink-3); }
</style>
