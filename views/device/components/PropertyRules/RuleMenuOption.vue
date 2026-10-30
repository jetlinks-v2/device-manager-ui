<template>
  <span class="rule-menu-option" :class="{ 'rule-menu-option-compact': compact }">
    <span class="rule-menu-option-icon"><slot name="icon"><AIcon :type="icon" /></slot></span>
    <span class="rule-menu-option-copy"><span class="rule-menu-option-title">{{ title }}</span><span class="rule-menu-option-description">{{ description }}</span></span>
  </span>
</template>
<script setup lang="ts">
defineProps<{ icon: string; title: string; description: string; compact?: boolean }>()
</script>
<style scoped>
.rule-menu-option { display: grid; grid-template-columns: 24px minmax(0, 1fr); align-items: start; gap: var(--space-2); }
.rule-menu-option-icon { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; color: var(--jet-theme-primary); font-size: 16px; }
.rule-menu-option-alarm .rule-menu-option-icon { color: var(--jet-theme-warning); }
.rule-menu-option-copy { display: flex; flex-direction: column; min-width: 0; gap: 2px; }
.rule-menu-option-title { line-height: 24px; font-size: var(--fs-14); font-weight: 500; }
.rule-menu-option-description { color: var(--jet-theme-text-secondary); font-size: var(--fs-12); line-height: 18px; white-space: normal; }
.rule-menu-option-compact .rule-menu-option-title { font-size: var(--fs-12); line-height: 22px; }
.rule-menu-option-compact .rule-menu-option-icon { height: 22px; font-size: 14px; }
:global(.rule-select-menu) { max-width: calc(100vw - 48px); }
:global(.rule-select-menu .ant-select-item-option) { padding: 6px 12px; }
</style>
