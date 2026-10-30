<template>
  <a-popover :trigger="['hover', 'focus', 'click']" placement="top" @open-change="$event && $emit('open')">
    <template #content>
      <div class="template-status-content">
        <div v-for="item in events" :key="item.event" class="template-status-line">
          <span>{{ $t(`DeviceAlarm.notification.template.${item.event}`) }}</span>
          <span :class="`is-${item.state}`"><AIcon :type="icons[item.state]" />{{ $t(`DeviceAlarm.notification.template.${item.state}`) }}</span>
        </div>
        <div class="template-status-hint">{{ $t('DeviceAlarm.notification.template.hint') }}</div>
      </div>
    </template>
    <a-button type="text" size="small" class="notification-template-status" :class="`is-${state}`" :aria-label="$t('DeviceAlarm.notification.template.status')" @click.stop.prevent @keydown.stop>
      <AIcon :type="icons[state]" />
    </a-button>
  </a-popover>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DeviceAlarmNotifyMethod } from '../types'

const props = defineProps<{ templates?: DeviceAlarmNotifyMethod['templates']; includeRelieve?: boolean }>()
defineEmits<{ (e: 'open'): void }>()
const icons = { ready: 'CheckCircleOutlined', missing: 'ExclamationCircleOutlined', unknown: 'QuestionCircleOutlined', unneeded: 'CheckCircleOutlined' }
const events = computed(() => (props.includeRelieve ? ['trigger', 'relieve'] as const : ['trigger'] as const)
  .map(event => ({ event, state: props.templates?.[event] ?? 'unknown' })))
const state = computed(() => events.value.some(item => item.state === 'unknown') ? 'unknown'
  : events.value.some(item => item.state === 'missing') ? 'missing' : 'ready')
</script>

<style scoped lang="less">
.notification-template-status { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 22px; height: 24px; padding: 0; font-size: var(--fs-12); }
.is-ready, .is-unneeded { color: var(--jet-theme-success); }
.is-missing { color: var(--jet-theme-warning); }
.is-unknown { color: var(--jet-theme-text-secondary); }
.template-status-content { width: min(280px, calc(100vw - 48px)); color: var(--jet-theme-text); font-size: var(--fs-12); line-height: 1.7; }
.template-status-line { display: flex; justify-content: space-between; gap: var(--space-3); }
.template-status-line > span:last-child { display: inline-flex; align-items: center; gap: var(--space-1); }
.template-status-hint { margin-top: var(--space-2); color: var(--jet-theme-text-secondary); }
</style>
