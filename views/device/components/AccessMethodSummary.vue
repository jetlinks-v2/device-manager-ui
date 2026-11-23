<template>
  <div class="access-method-summary" :class="{ 'access-method-summary--with-icon': withIcon }">
    <span v-if="withIcon" class="access-method-summary__icon" aria-hidden="true"><AIcon type="ApiOutlined" /></span>
    <div class="access-method-summary__content">
    <div class="access-method-summary__row">
      <a-tooltip :title="summary.name || '--'">
        <span class="access-method-summary__name">{{ summary.name || '--' }}</span>
      </a-tooltip>
      <span v-if="tags.length" class="access-method-summary__tags">
        <a-tooltip v-for="tag in tags" :key="tag.key" :title="tag.label">
          <a-tag class="access-method-summary__tag">{{ tag.value }}</a-tag>
        </a-tooltip>
      </span>
    </div>
    <div v-if="summary.description && summary.description !== '--'" class="access-method-summary__description">
      {{ summary.description }}
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

interface AccessMethodSummary {
  name?: string
  transport?: string
  protocol?: string
  description?: string
}

// 产品和设备共用接入摘要；调用方负责提供已本地化的展示名称。
const props = defineProps({
  withIcon: Boolean,
  summary: { type: Object as PropType<AccessMethodSummary>, required: true },
})
const { t: $t } = useI18n()
const tags = computed(() => [
  { key: 'transport', label: $t('IotDeviceDetail.accessDetail.transport'), value: props.summary.transport?.trim() },
  { key: 'protocol', label: $t('DeviceAccess.index.594346-6'), value: props.summary.protocol?.trim() },
].filter(tag => tag.value && tag.value !== '--'))
</script>

<style scoped lang="less">
.access-method-summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}
.access-method-summary__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}
.access-method-summary__name {
  min-width: 0;
  max-width: min(24rem, 100%);
  overflow: hidden;
  color: var(--jet-theme-text);
  font-size: var(--fs-14);
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 标签作为一组换行，长名称只在自身区域省略。 */
.access-method-summary__tags {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--space-2);
  max-width: 100%;
}
.access-method-summary__tag {
  min-width: 0;
  min-height: 1.5rem;
  margin-inline-end: 0;
  border-color: var(--jet-theme-border-secondary);
  background: var(--jet-theme-bg-layout);
  color: var(--jet-theme-text-secondary);
  font-weight: 500;
  white-space: normal;
  overflow-wrap: anywhere;
}
.access-method-summary__description {
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.access-method-summary__content { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
.access-method-summary--with-icon { display: grid; grid-template-columns: 2.75rem minmax(0, 1fr); gap: var(--space-3); align-items: start; }
.access-method-summary__icon { display: grid; place-items: center; width: 2.75rem; height: 2.75rem; border-radius: var(--r-2); background: var(--jet-theme-primary-soft); color: var(--jet-theme-primary); font-size: var(--fs-20); }
</style>
