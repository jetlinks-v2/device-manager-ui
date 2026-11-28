<template>
  <div class="device-tag-editor" :class="{ 'device-tag-editor--compact': compact }" @keydown.esc.stop="$emit('close')">
    <div class="device-tag-editor__label">{{ getTagLabel(draft) }}</div>
    <fieldset :disabled="saving" :class="{ 'is-saving': saving }">
      <TagValueInput :model-value="draft.value" :tag="draft" :compact="compact" @update:model-value="$emit('update:value', $event)" />
    </fieldset>
    <div v-if="failed" role="alert" class="device-tag-editor__error">{{ $t('IotDeviceDetail.detail.saveFailed') }}</div>
    <div class="device-tag-editor__actions">
      <a-button :type="compact ? 'text' : 'default'" :size="compact ? 'small' : 'middle'" :title="$t('IotDeviceDetail.common.cancel')" :aria-label="$t('IotDeviceDetail.common.cancel')" :disabled="saving" @click="$emit('close')"><AIcon v-if="compact" type="CloseOutlined" aria-hidden="true" /><template v-else>{{ $t('IotDeviceDetail.common.cancel') }}</template></a-button>
      <a-button :type="compact ? 'text' : 'primary'" :size="compact ? 'small' : 'middle'" class="device-tag-editor__save" :title="$t('IotDeviceDetail.tagEditor.save')" :aria-label="$t('IotDeviceDetail.tagEditor.save')" :loading="saving" @click="$emit('save')"><AIcon v-if="compact" type="CheckOutlined" aria-hidden="true" /><template v-else>{{ $t('IotDeviceDetail.tagEditor.save') }}</template></a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import TagValueInput from './TagValueInput.vue'
import { computed } from 'vue'
import { getTagLabel, getTagType, type DeviceTag } from './tagEditor'

const props = defineProps<{ draft: DeviceTag; saving: boolean; failed: boolean }>()
const compact = computed(() => !['object','array','geoPoint'].includes(getTagType(props.draft)))
defineEmits<{ 'update:value': [value: unknown]; close: []; save: [] }>()
</script>

<style scoped>
.device-tag-editor { width: min(17rem, calc(100vw - 4rem)); }
.device-tag-editor__label { margin-bottom:8px; font-size:12px; color:var(--jet-theme-text-secondary); overflow-wrap:anywhere; }
.device-tag-editor fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
.device-tag-editor .is-saving { pointer-events: none; }
.device-tag-editor__actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-3); }
.device-tag-editor__error { margin-top: var(--space-2); color: var(--jet-theme-error); font-size: var(--fs-12); }
.device-tag-editor--compact { display:grid; grid-template-columns:minmax(0,5rem) minmax(4rem,1fr) auto; align-items:center; gap:4px; }
.device-tag-editor--compact .device-tag-editor__label { margin:0; }
.device-tag-editor--compact .device-tag-editor__actions { grid-column:3; grid-row:1; gap:0; margin:0; }
.device-tag-editor--compact .device-tag-editor__actions :deep(.ant-btn) { width:24px; height:24px; padding:0; }
.device-tag-editor--compact .device-tag-editor__save { color:var(--jet-theme-primary); }
.device-tag-editor--compact .device-tag-editor__error { grid-column:1/-1; grid-row:2; }
</style>
