<template>
  <a-tooltip :title="message" :trigger="['hover', 'focus']" :overlay-style="{ maxWidth: '360px' }">
    <span class="rule-notice" tabindex="0" role="img" :aria-label="message" @click.stop.prevent @keydown.enter.stop.prevent @keydown.space.stop.prevent @keydown.stop><AIcon type="ExclamationCircleOutlined" aria-hidden="true" /></span>
  </a-tooltip>
</template>
<script setup lang="ts">
defineProps<{ message: string }>()
</script>
<style scoped>
.rule-notice { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 12px; line-height: 1; color: var(--jet-theme-warning); cursor: help; }
.rule-notice:focus-visible { outline: 1px solid var(--jet-theme-primary); outline-offset: 2px; border-radius: 50%; }
</style>
