<template>
  <a-list-item class="access-list-item principal-item">
    <a-list-item-meta>
      <template #title>
        <div class="plain-item-head">
          <div class="plain-item-head__left">

            <span class="plain-item-title">{{ $t('IotDeviceDetail.accessDetail.principalTitle') }}</span>

          </div>
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
              <DocumentHelp v-if="principal.authenticationType === 'MQTT'" code="iot-user-device-list" help-key="access.mqttPrincipal" />
              <a-tooltip v-else-if="principal.description" :title="principal.description">
                <AIcon type="QuestionCircleOutlined" class="metadata-help" />
              </a-tooltip>
            </div>
            <div class="principal-card__fields">
              <div
                v-for="field in principal.fields"
                :key="field.label"
                class="info-field"
              >
                <span class="field-label"><AIcon :type="field.sensitive ? 'LockOutlined' : 'IdcardOutlined'" />{{ field.label }}</span>
                <div class="field-value">
                  <a-button size="small" class="principal-copy" :disabled="!field.copyValue" :aria-label="$t('IotDeviceDetail.accessConfig.copy') + ' ' + field.label" @click="$emit('copy', field.copyValue || '')">
                    <template v-if="field.sensitive">{{ $t('IotDeviceAccess.principal.copyPlaceholder') }}</template>
                    <template v-else><span class="principal-copy__text" :title="field.value">{{ field.value || '--' }}</span><AIcon type="CopyOutlined" /></template>
                  </a-button>
                </div>
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
import DocumentHelp from '@jetlinks-web-core/components/DocumentHelp'

type PrincipalRow = {
  id: string
  name: string
  description?: string
  authenticationType?: string
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

</script>

<style scoped lang="less">
.access-list-item { padding: var(--space-3) 0 !important; }
.plain-item-head, .plain-item-head__left { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
.plain-item-head { justify-content: space-between; width: 100%; }
.plain-item-title { color: var(--jet-theme-text); font-size: var(--fs-16); font-weight: 600; }
.principal-cards, .principal-card { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }
.principal-card { padding: var(--space-3) var(--space-4); border: 1px solid var(--jet-theme-border-secondary); border-radius: var(--r-2); background: color-mix(in srgb, var(--jet-theme-primary) 3%, var(--jet-theme-bg-container)); }
.principal-card__type { display: flex; align-items: center; gap: var(--space-1); }
.principal-card__fields { display: grid; gap: var(--space-2); width: 100%; }
.metadata-tag { margin-inline-end: 0; }
.info-field { display: grid; grid-template-columns: 7rem minmax(0, 1fr); align-items: center; gap: var(--space-3); min-width: 0; }
.field-label { display: flex; align-items: center; gap: var(--space-2); color: var(--jet-theme-text-secondary); overflow-wrap: anywhere; }
.field-label :deep(.anticon) { color: var(--jet-theme-primary); }
.field-value { min-width: 0; }
.principal-copy { display: inline-flex; align-items: center; gap: var(--space-2); max-width: 100%; height: auto; min-height: 1.5rem; padding: 0 var(--space-2); font-size: var(--fs-12); text-align: left; }
.principal-copy__text { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
@media (max-width: 30rem) { .info-field { grid-template-columns: 5.5rem minmax(0, 1fr); gap: var(--space-2); } }
</style>
