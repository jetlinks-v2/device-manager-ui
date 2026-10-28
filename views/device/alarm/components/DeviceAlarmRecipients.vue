<template>
  <div class="alarm-recipients">
    <div class="alarm-recipients__selection">
      <a-tag v-for="user in directory.selected" :key="user.value" :closable="!disabled" :title="user.description || user.label" @close.prevent="$emit('update:value', value.filter(id => id !== user.value))"><AIcon type="UserOutlined" /> {{ user.label }}</a-tag>
      <a-button type="text" size="small" :disabled="disabled" :aria-expanded="directory.open" @click="directory.setOpen(!directory.open)"><AIcon :type="value.length ? 'UserAddOutlined' : 'TeamOutlined'" />{{ $t(value.length ? 'DeviceAlarm.notification.selectUsers' : 'DeviceAlarm.notification.userPlaceholder') }}<AIcon :type="directory.open ? 'UpOutlined' : 'DownOutlined'" /></a-button>
    </div>
    <div v-if="directory.open" class="alarm-recipients__panel">
      <a-alert v-if="directory.candidateFailed || directory.selectedFailed" type="warning" show-icon :message="$t('DeviceAlarm.notification.usersFailed')">
        <template #action><a-button type="link" size="small" @click="directory.retry">{{ $t('PropertyRules.retry') }}</a-button></template>
      </a-alert>
      <ConditionOptionPanel :key="directory.revision" :value="value" :config="directory.config" :options="directory.options" @update:value="$emit('update:value', $event)" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { ConditionOptionPanel } from '@jetlinks-web-core/components/ConditionFilter'
import { useAlarmRecipients } from '../hooks/useAlarmRecipients'
const props = defineProps<{ value: string[]; scopeKey: string; disabled?: boolean }>()
defineEmits<{ (e: 'update:value', value: string[]): void }>()
const { t: $t } = useI18n()
const directory = reactive(useAlarmRecipients(props))
</script>
<style scoped>
.alarm-recipients { min-width: 0; }
.alarm-recipients__selection { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1); min-height: 30px; }
.alarm-recipients__selection :deep(.ant-tag) { max-width: 100%; margin: 0; overflow-wrap: anywhere; white-space: normal; background: var(--bg-sunken); border-color: var(--line); }
.alarm-recipients__selection :deep(.ant-btn) { height: auto; white-space: normal; text-align: left; padding-inline: var(--space-1); color: var(--jet-theme-text-secondary); }
.alarm-recipients__panel { margin-top: var(--space-2); padding-top: var(--space-2); border-top: 1px solid var(--line); }
.alarm-recipients__panel :deep(.condition-option-panel__list) { max-height: min(220px, 30vh); }
.alarm-recipients__panel :deep(.condition-option-panel__hint) { display: none; }
.alarm-recipients__panel :deep(.ant-alert) { margin-bottom: var(--space-2); }
</style>
