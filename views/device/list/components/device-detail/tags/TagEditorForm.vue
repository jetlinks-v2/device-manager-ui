<template>
  <div class="device-tag-editor" @keydown.esc.stop="$emit('close')">
    <fieldset :disabled="saving" :class="{ 'is-saving': saving }">
      <TagValueInput :model-value="draft.value" :tag="draft" @update:model-value="$emit('update:value', $event)" />
    </fieldset>
    <div v-if="failed" role="alert" class="device-tag-editor__error">{{ $t('IotDeviceDetail.detail.saveFailed') }}</div>
    <div class="device-tag-editor__actions">
      <a-button :disabled="saving" @click="$emit('close')">{{ $t('IotDeviceDetail.common.cancel') }}</a-button>
      <a-button type="primary" :loading="saving" @click="$emit('save')">{{ $t('IotDeviceDetail.tagEditor.save') }}</a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import TagValueInput from './TagValueInput.vue'
import type { DeviceTag } from './tagEditor'

defineProps<{ draft: DeviceTag; saving: boolean; failed: boolean }>()
defineEmits<{ 'update:value': [value: unknown]; close: []; save: [] }>()
</script>

<style scoped>
.device-tag-editor { width: min(17rem, calc(100vw - 4rem)); }
.device-tag-editor fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
.device-tag-editor .is-saving { pointer-events: none; }
.device-tag-editor__actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-3); }
.device-tag-editor__error { margin-top: var(--space-2); color: var(--jet-theme-error); font-size: var(--fs-12); }
</style>
