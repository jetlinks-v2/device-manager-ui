<template>
  <a-popover :trigger="['hover', 'focus', 'click']" placement="top">
    <template #content><div class="rule-notice-content">{{ message }}</div></template>
    <a-button type="text" size="small" class="rule-notice" :class="{ 'is-info': kind === 'info' }" :disabled="false" :aria-label="label ?? message" @click.stop @keydown.stop><AIcon :type="kind === 'info' ? 'InfoCircleOutlined' : 'ExclamationCircleOutlined'" aria-hidden="true" /></a-button>
  </a-popover>
</template>
<script setup lang="ts">
defineProps<{ message: string; label?: string; kind?: 'info' | 'warning' }>()
</script>
<style scoped>
.rule-notice { --rule-notice-color: var(--jet-theme-warning); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 18px; height: 20px; padding: 0; border: 0; border-radius: var(--radius-sm, 4px); color: var(--rule-notice-color); font-size: 12px; line-height: 20px; cursor: pointer; }
.rule-notice.is-info { --rule-notice-color: var(--jet-theme-text-secondary); width: 24px; height: 24px; font-size: 14px; }
.rule-notice:not(:disabled):hover, .rule-notice:focus-visible { background: var(--bg-sunken); color: var(--rule-notice-color); }
.rule-notice:focus-visible { outline: 1px solid var(--jet-theme-primary); outline-offset: 1px; }
.rule-notice-content { max-width: min(320px, calc(100vw - 48px)); color: var(--jet-theme-text); font-size: var(--fs-12); line-height: 1.7; }
</style>
