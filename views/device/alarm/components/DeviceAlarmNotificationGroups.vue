<template>
  <div class="notification-groups">
    <div v-for="group in view.groups" :key="group.id" class="notification-group">
      <div v-if="!summaryOnly" class="notification-group__heading">
        <a-button type="link" size="small" :disabled="disabled" @click="$emit('edit', group.id)"><img v-if="group.key === 'wechat' || group.key === 'dingtalk'" class="notification-group__icon" :src="group.key === 'wechat' ? WeixinCorp : DingTalk" alt="" />{{ group.label }}</a-button>
        <a-button type="text" size="small" :disabled="disabled" :aria-label="$t('DeviceAlarm.notification.removeChannel', { channel: group.label })" @click="$emit('remove', { channelId: group.id })"><AIcon type="CloseOutlined" /></a-button>
      </div>
      <span v-if="group.fixed" class="notification-group__hint">{{ $t('DeviceAlarm.notification.fixedRecipientHint') }}</span>
      <template v-else>
        <div class="notification-group__users">
          <a-tag v-for="user in group.users" :key="user.id" :closable="!disabled" @close.prevent="$emit('remove', { channelId: group.id, userId: user.id })">{{ user.name }}</a-tag>
          <a-tag v-for="target in group.targets" :key="`${target.type}:${target.id}`" :closable="!disabled"
            @close.prevent="$emit('remove', { channelId: group.id, dimension: { type: target.type, id: target.id } })">{{ target.label }}</a-tag>
          <span v-if="group.dimensions && !group.targets.length" class="notification-group__hint">{{ $t('DeviceAlarm.notification.dimensionRecipients') }}</span>
          <span v-if="!group.users.length && !group.dimensions" class="notification-group__hint">{{ $t('DeviceAlarm.notification.userShort') }}</span>
        </div>
      </template>
    </div>
    <a-alert v-if="view.directory.selectedFailed" type="warning" show-icon :message="$t('DeviceAlarm.notification.usersFailed')"><template #action><a-button type="link" size="small" @click="view.directory.retry">{{ $t('PropertyRules.retry') }}</a-button></template></a-alert>
    <a-alert v-for="kind in view.targets.failedKinds" :key="kind" type="warning" show-icon :message="$t('DeviceAlarm.notification.targetsFailed')">
      <template #action><a-button type="link" size="small" @click="view.targets.retry(kind)">{{ $t('PropertyRules.retry') }}</a-button></template>
    </a-alert>
  </div>
</template>
<script setup lang="ts">
import { reactive } from 'vue'
import { DingTalk, WeixinCorp } from '@jetlinks-web-core/assets/notice'
import { useAlarmNotificationGroups } from '../hooks/useAlarmNotificationGroups'
import type { DeviceAlarmNotificationConfig, DeviceAlarmNotifyMethod, DeviceAlarmRecipientSelection } from '../types'
const props = withDefaults(defineProps<{ notification: DeviceAlarmNotificationConfig; methods: DeviceAlarmNotifyMethod[]; scopeKey: string; disabled?: boolean; channelId?: string; summaryOnly?: boolean }>(), { disabled: false, summaryOnly: false })
defineEmits<{ (e: 'edit', channelId: string): void; (e: 'remove', selection: DeviceAlarmRecipientSelection): void }>()
const view = reactive(useAlarmNotificationGroups(props))
</script>
<style scoped>
.notification-groups { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }
.notification-group { min-width: 0; }
.notification-group__heading { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
.notification-group__heading :deep(.ant-btn-link) { height: auto; padding-inline: 0; white-space: normal; text-align: start; }
.notification-group__icon { width: 16px; height: 16px; margin-inline-end: var(--space-1); object-fit: contain; vertical-align: middle; }
.notification-group__users { display: flex; flex-wrap: wrap; gap: var(--space-1); }
.notification-group__users :deep(.ant-tag) { max-width: 100%; margin: 0; white-space: normal; overflow-wrap: anywhere; }
.notification-group__hint { color: var(--jet-theme-text-secondary); font-size: var(--fs-12); overflow-wrap: anywhere; }
</style>
