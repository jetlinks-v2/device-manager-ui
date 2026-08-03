<template>
  <a-list-item class="access-list-item principal-item">
    <a-list-item-meta>
      <template #title>
        <div class="plain-item-head">
          <div class="plain-item-head__left">
            <div class="title-before" aria-hidden="true" />
            <span class="plain-item-title">{{ $t('IotDeviceDetail.accessDetail.principalTitle') }}</span>
            <a-popconfirm
              :title="$t('IotDeviceDetail.accessDetail.principalConfirmReset')"
              placement="bottomRight"
              @confirm="$emit('reset')"
            >
              <a-button
                type="link"
                size="small"
                class="reset-button"
                :loading="resetting"
                :disabled="resetting"
              >
                <template #icon><AIcon type="SyncOutlined" /></template>
              {{ $t('IotDeviceDetail.common.reset') }}
              </a-button>
            </a-popconfirm>
          </div>
        </div>
      </template>
      <template #description>
        <div class="principal-cards">
          <section
            v-for="principal in principalRows"
            :key="principal.id"
            class="principal-card"
          >
            <div class="principal-card__type">
              <a-tag class="metadata-tag">{{ principal.name }}</a-tag>
              <a-tooltip v-if="principal.description" :title="principal.description">
                <AIcon type="QuestionCircleOutlined" class="metadata-help" />
              </a-tooltip>
            </div>
            <div class="principal-card__fields">
              <div
                v-for="field in principal.fields"
                :key="field.label"
                class="info-field"
              >
                <AIcon :type="fieldIcon(field.label)" class="field-icon" />
                <span class="field-label">{{ field.label }}</span>
                <a-tag
                  class="field-value-tag"
                  :class="{ 'clickable-tag': Boolean(field.copyValue) }"
                  @click="field.copyValue && $emit('copy', field.copyValue)"
                >
                  <span class="field-text">{{ fieldText(field) }}</span>
                  <AIcon
                    v-if="field.copyValue && !field.sensitive"
                    type="CopyOutlined"
                    class="copy-icon"
                  />
                </a-tag>
              </div>
            </div>
          </section>
        </div>
      </template>
    </a-list-item-meta>
  </a-list-item>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'

type PrincipalRow = {
  id: string
  name: string
  description?: string
  fields: Array<{
    label: string
    value?: string
    copyValue?: string
    sensitive?: boolean
  }>
}

defineEmits<{
  (e: 'copy', value: string): void
  (e: 'reset'): void
}>()

defineProps({
  principalRows: { type: Array as PropType<PrincipalRow[]>, required: true },
  resetting: { type: Boolean, default: false },
})

const { t: $t } = useI18n()

function fieldIcon(label: string) {
  if (label.includes('用户名')) return 'UserOutlined'
  if (label.includes('密码') || label.includes('Token')) return 'LockOutlined'
  return 'IdcardOutlined'
}

function fieldText(field: PrincipalRow['fields'][number]) {
  if (field.sensitive) return field.copyValue ? $t('IotDeviceAccess.principal.copyPlaceholder') : '--'
  return field.value || '--'
}
</script>

<style lang="less" scoped>
.access-list-item {
  padding: var(--space-3) 0 !important;
}

.plain-item-head,
.plain-item-head__left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.plain-item-head {
  justify-content: space-between;
  width: 100%;
}

.plain-item-head__left {
  min-width: 0;
}

.plain-item-title {
  color: var(--jet-theme-text);
  font-size: var(--fs-16);
  font-weight: 600;
}

.title-before {
  width: 0.1875rem;
  height: var(--space-3);
  border-radius: var(--r-1);
  background: var(--jet-theme-primary);
}

.principal-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.principal-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  min-width: 0;
  padding: var(--space-3) var(--space-4);
  border: var(--jet-theme-stroke-width) solid var(--jet-theme-border-secondary);
  border-radius: var(--jet-theme-radius);
  background: color-mix(in srgb, var(--jet-theme-primary-soft) 42%, var(--jet-theme-bg-container));
}

.principal-card__type,
.principal-card__fields {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.principal-card__type {
  gap: var(--space-1);
  flex: 0 0 auto;
  min-height: 1.5rem;
}

.principal-card__fields {
  width: 100%;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-2);
}

.metadata-tag {
  flex-shrink: 0;
  margin-inline-end: 0;
  border-color: color-mix(in srgb, var(--jet-theme-primary) 28%, var(--jet-theme-border));
  background: color-mix(in srgb, var(--jet-theme-primary) 8%, var(--jet-theme-bg-container));
  color: var(--jet-theme-primary);
}

.metadata-help {
  color: var(--jet-theme-primary);
  font-size: var(--fs-12);
}

.info-field {
  display: grid;
  grid-template-columns: 1rem 4.5rem minmax(0, 1fr);
  align-items: center;
  gap: var(--space-1);
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.field-icon {
  color: var(--jet-theme-primary);
}

.field-label {
  color: var(--jet-theme-text-secondary);
}

.field-value-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  width: fit-content;
  max-width: 100%;
  min-height: 1.5rem;
  height: auto;
  min-width: 0;
  margin-inline-end: 0;
  border-color: var(--jet-theme-border-secondary);
  background: var(--jet-theme-bg-container);
  color: var(--jet-theme-text);
  white-space: normal;
}

.copy-icon {
  flex: 0 0 auto;
  color: var(--jet-theme-text-disabled);
}

.clickable-tag {
  cursor: pointer;
}

.clickable-tag:hover {
  border-color: color-mix(in srgb, var(--jet-theme-primary) 36%, var(--jet-theme-border));
  color: var(--jet-theme-primary);
}

.field-text {
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: visible;
  text-overflow: clip;
  line-height: 1.5;
  white-space: normal;
  word-break: break-all;
}

@media (max-width: 64rem) {
  .principal-card {
    align-items: start;
  }

  .info-field {
    grid-template-columns: 1rem minmax(4.5rem, auto);
  }

  .field-value-tag {
    grid-column: 2;
    max-width: 100%;
  }
}
</style>
