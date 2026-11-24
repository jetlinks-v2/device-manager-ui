<template>
  <div class="notification-blocks" :class="{ 'notification-blocks--compact': compact }">
    <div class="notification-blocks__items">
      <section v-for="(block, index) in view.items" :key="block.key" :ref="element => view.setElement(block.key, element)"
        class="notification-block" :aria-label="$t('DeviceAlarm.notification.channelBlock', { index: index + 1 })">
        <div class="notification-block__heading">
          <div class="notification-block__title">
            <template v-if="compact">
              <img v-if="block.method?.key === 'wechat' || block.method?.key === 'dingtalk'" class="notification-block__icon" :src="block.method.key === 'wechat' ? WeixinCorp : DingTalk" alt="" />
              <AIcon v-else :type="block.method?.icon || 'SendOutlined'" />
              <a-select :value="block.channelId" :options="block.channelOptions" size="small" :bordered="false"
                :dropdown-match-select-width="false"
                class="notification-block__channel" :aria-label="$t('DeviceAlarm.editor.notificationChannel')"
                :placeholder="$t('DeviceAlarm.notification.channelShort')" :loading="loading" :disabled="disabled || loading || failed"
                @update:value="view.selectChannel(block.key, $event)">
                <template #option="{ label }"><span class="notification-block__channel-option">{{ label }}</span></template>
              </a-select>
            </template>
            <label v-else :for="`iot-alarm-channel-${block.key}`">{{ $t('DeviceAlarm.editor.notificationChannel') }}</label>
            <DeviceAlarmTemplateStatus v-if="block.channelId && block.templates" :templates="block.templates"
              :include-relieve="Boolean(model.autoRelieve && model.notification.includeRelieve)" @open="$emit('refresh')" />
          </div>
          <div class="notification-block__actions">
            <template v-if="canConfigure && block.channelId && block.channelId !== 'inside-mail'">
              <a-button type="text" size="small" class="notification-block__template-action" :disabled="disabled" @click="$emit('configure', 'alarm-device', block.channelId)">{{ $t('DeviceAlarm.notification.configureTemplate') }}</a-button>
              <a-button v-if="model.autoRelieve && model.notification.includeRelieve && model.notification.relieveTopicProvider !== 'alarm-device'" type="text" size="small" class="notification-block__template-action" :disabled="disabled"
                @click="$emit('configure', 'alarm-device-relieve', block.channelId)">{{ $t('DeviceAlarm.notification.configureRelieveTemplate') }}</a-button>
            </template>
            <a-button v-if="block.channelId || view.items.length > 1" type="text" size="small" :disabled="disabled || loading || failed"
              :aria-label="$t('DeviceAlarm.notification.removeChannelBlock', { index: index + 1 })" @click="view.remove(block.key)"><AIcon :type="compact ? 'CloseOutlined' : 'DeleteOutlined'" /></a-button>
          </div>
        </div>
        <a-select v-if="!compact" :id="`iot-alarm-channel-${block.key}`" :value="block.channelId" :options="block.channelOptions" size="large"
          :placeholder="$t('DeviceAlarm.notification.channelShort')" :loading="loading" :disabled="disabled || loading || failed"
          @update:value="view.selectChannel(block.key, $event)" />
        <a-alert v-if="block.unavailable" type="warning" show-icon :message="$t('DeviceAlarm.notification.unavailableChannel')" />
        <span v-else-if="block.fixed" class="notification-block__hint">{{ $t('DeviceAlarm.notification.fixedRecipientHint') }}</span>
        <div v-else-if="block.channelId" class="notification-block__recipients">
          <span class="notification-block__label">{{ $t(compact ? 'DeviceAlarm.notification.sendTo' : 'DeviceAlarm.notification.user') }}</span>
          <div class="notification-block__targets">
            <DeviceAlarmRecipientTargets :key="block.channelId" :targets="block" :scope-key="`${view.scopeKey}:${block.channelId}`"
              :layout="compact ? 'compact' : 'form'" :disabled="disabled || loading || failed" :open="view.recipientKey === block.key"
              @kind="view.setKind(block.key, $event)" @targets="(kind, ids) => view.setTargets(block.key, kind, ids)"
              @retry="view.retry" @update:open="view.setRecipientOpen(block.key, $event)" />
            <DeviceAlarmNotificationGroups v-if="compact" summary-only :notification="model.notification" :methods="methods"
              :channel-id="block.channelId" :scope-key="view.scopeKey" :disabled="disabled || loading || failed" @remove="view.removeRecipient" />
          </div>
        </div>
      </section>
    </div>
    <div class="notification-blocks__footer">
      <a-button :type="compact ? 'text' : 'dashed'" :block="!compact" :disabled="disabled || loading || failed" @click="view.add"><AIcon type="PlusOutlined" />{{ $t('DeviceAlarm.notification.addChannel') }}</a-button>
      <slot name="footer" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { onBeforeUnmount, reactive, watch } from 'vue'
import { DingTalk, WeixinCorp } from '@jetlinks-web-core/assets/notice'
import DeviceAlarmRecipientTargets from './DeviceAlarmRecipientTargets.vue'
import DeviceAlarmNotificationGroups from './DeviceAlarmNotificationGroups.vue'
import DeviceAlarmTemplateStatus from './DeviceAlarmTemplateStatus.vue'
import { useAlarmNotificationBlocks, type AlarmNotificationBlocksProps } from '../hooks/useAlarmNotificationBlocks'
const props = defineProps<AlarmNotificationBlocksProps & { canConfigure?: boolean }>()
const emit = defineEmits<{ configure: [topic: 'alarm-device' | 'alarm-device-relieve', id: string]; refresh: []; 'open-change': [open: boolean] }>()
const view = reactive(useAlarmNotificationBlocks(props))
watch(() => view.recipientKey, key => emit('open-change', key !== undefined))
onBeforeUnmount(() => emit('open-change', false))
</script>
<style scoped>
.notification-blocks, .notification-blocks__items { display: grid; gap: var(--space-4); min-width: 0; }
.notification-block { display: grid; gap: var(--space-3); min-width: 0; padding: var(--space-4); border: 1px solid var(--line); border-radius: var(--r-4); background: var(--bg); }
.notification-block__heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-2); min-height: 24px; color: var(--ink-1); font-weight: 600; }
.notification-block__title { display: flex; align-items: center; gap: var(--space-1); min-width: 0; }
.notification-block__label, .notification-block__hint { color: var(--ink-3); font-size: var(--fs-12); overflow-wrap: anywhere; }
.notification-block__actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: var(--space-1); margin-inline-start: auto; }
.notification-block__template-action:not(:disabled) { color: var(--ink-3); }
.notification-block__template-action:not(:disabled):hover, .notification-block__template-action:focus-visible { color: var(--accent); }
.notification-blocks:not(.notification-blocks--compact) .notification-block :deep(.notification-chip) { width: 100%; }
.notification-block__recipients, .notification-block__targets { display: grid; gap: var(--space-3); min-width: 0; }
.notification-blocks__footer { display: grid; gap: var(--space-4); min-width: 0; }
.notification-blocks--compact { gap: var(--space-2); width: 100%; font-size: var(--fs-14); }
.notification-blocks--compact .notification-blocks__items { gap: var(--space-3); }
.notification-blocks--compact .notification-block { gap: var(--space-2); border: 0; border-radius: 0; padding: 0; background: transparent; }
.notification-blocks--compact .notification-block + .notification-block { padding-top: var(--space-2); border-top: 1px solid var(--line); }
.notification-blocks--compact .notification-block__heading { flex-wrap: nowrap; font-weight: 500; }
.notification-blocks--compact .notification-block__title { flex: 1; gap: var(--space-1); }
.notification-block__icon { width: 16px; height: 16px; object-fit: contain; flex: none; }
.notification-block__channel { flex: 0 1 auto; min-width: calc(var(--space-4) * 6); max-width: 100%; }
.notification-block__channel :deep(.ant-select-selector) { padding-inline: 0; }
.notification-block__channel-option { display: block; width: min(calc(var(--space-4, 16px) * 20), calc(100vw - var(--space-4, 16px) * 4)); white-space: normal; overflow-wrap: anywhere; }
.notification-blocks--compact .notification-block__recipients { grid-template-columns: auto minmax(0, 1fr); gap: var(--space-3); }
.notification-blocks--compact .notification-block__label { padding-top: var(--space-1); font-size: inherit; }
.notification-blocks--compact .notification-block__targets { justify-items: start; gap: var(--space-1); }
.notification-blocks--compact .notification-block__hint { padding-inline-start: calc(var(--space-4) + var(--space-1)); line-height: 1.5; }
.notification-blocks--compact .notification-blocks__footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-2); }
.notification-blocks--compact .notification-blocks__footer > :deep(.ant-btn) { padding-inline: 0; color: var(--jet-theme-primary); }
@media (max-width: 540px) {
  .notification-blocks--compact .notification-block__heading { flex-wrap: wrap; }
  .notification-blocks--compact .notification-block__title { flex-basis: 100%; }
  .notification-blocks--compact .notification-block__recipients { grid-template-columns: minmax(0, 1fr); gap: var(--space-1); }
}
</style>
