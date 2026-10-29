<template>
  <a-popover :open="directory.open" :trigger="['click']" placement="bottomLeft" :destroy-tooltip-on-hide="true" @open-change="$emit('update:open', $event)">
    <template #content>
      <div class="notification-option-panel" @keydown.esc.stop.prevent="closePanel">
        <a-alert v-if="directory.candidateFailed || directory.selectedFailed" type="warning" show-icon :message="$t('DeviceAlarm.notification.usersFailed')">
          <template #action><a-button type="link" size="small" @click="directory.retry">{{ $t('PropertyRules.retry') }}</a-button></template>
        </a-alert>
        <ConditionOptionPanel v-if="directory.open" :key="directory.revision" :value="value" :config="directory.config" :options="directory.options" @update:value="$emit('update:value', $event)" />
      </div>
    </template>
    <a-button ref="trigger" type="text" size="small" class="notification-chip" :disabled="disabled" :aria-label="$t('DeviceAlarm.notification.user')" :aria-expanded="directory.open" :title="directory.selectionTitle">
      <AIcon type="TeamOutlined" /><span class="notification-chip__label">{{ directory.selectionLabel }}</span>
      <span v-if="value.length > 1 && directory.firstSelectedLabel" class="notification-chip__count">+{{ value.length - 1 }}</span>
      <AIcon type="DownOutlined" class="notification-chip__arrow" />
    </a-button>
  </a-popover>
</template>
<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ConditionOptionPanel } from '@jetlinks-web-core/components/ConditionFilter'
import { useAlarmRecipients } from '../hooks/useAlarmRecipients'
const props = defineProps<{ value: string[]; scopeKey: string; open: boolean; disabled?: boolean }>()
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
