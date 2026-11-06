<template>
  <button type="button" class="gateway-resource" :class="{ 'is-selected': checked === data.id }"
    :disabled="disabled" :aria-pressed="checked === data.id" @click="emit('checkedChange', data.id)">
    <strong>{{ data.name }}</strong>
    <AIcon v-if="checked === data.id" class="gateway-resource__check" type="CheckCircleFilled" />
    <slot name="other" />
    <span class="gateway-resource__description" :title="data.description">{{ data.description || t('Plugin.index.626239-29') }}</span>
  </button>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
defineProps<{ checked?: string; data: { id: string; name?: string; description?: string; type?: string }; disabled?: boolean }>()
const emit = defineEmits<{ checkedChange: [id: string] }>()
const { t } = useI18n()
</script>
<style scoped>
.gateway-resource { position: relative; display: flex; flex-direction: column; gap: var(--space-2); width: 100%; text-align: left; padding: var(--space-4); border: 1px solid var(--line); border-radius: var(--r-3); background: var(--bg); color: var(--text-color); cursor: pointer; }
.gateway-resource strong { padding-right: var(--space-5); font-size: var(--fs-14); font-weight: 600; }
.gateway-resource:hover, .gateway-resource.is-selected { border-color: var(--primary-color); }
.gateway-resource.is-selected { background: var(--primary-color-deprecated-bg, #e8f1ff); outline: 1px solid var(--primary-color); outline-offset: -2px; }
.gateway-resource__check { position: absolute; right: var(--space-4); top: var(--space-4); color: var(--primary-color); }
.gateway-resource__description { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; color: var(--text-color-secondary); font-size: var(--fs-12); line-height: 1.6; }
.gateway-resource:disabled { cursor: not-allowed; }
.gateway-resource:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
</style>
