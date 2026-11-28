<template>
  <a-modal
    centered
    :width="640"
    :mask-closable="false"
    :open="true"
    :title="$t('InklingModal.index.380043-0')"
    :confirmLoading="loading"
    :ok-button-props="{ disabled: !checkKey }"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <a-descriptions class="device-mapping-identity" size="small" layout="vertical" :column="{ xs: 1, sm: 2 }">
      <a-descriptions-item :label="$t('InklingModal.platformId')"><span class="device-mapping-identity__value">{{ internalId }}</span></a-descriptions-item>
      <a-descriptions-item :label="$t('InklingModal.externalId')"><span class="device-mapping-identity__value" :class="{ 'is-empty': !checkKey }">{{ checkKey || $t('InklingModal.index.380043-1') }}</span></a-descriptions-item>
    </a-descriptions>
    <p class="device-mapping-hint">{{ $t('InklingModal.sameIdHint') }}</p>
    <InklingDevice
      v-model:value='checkKey'
      type="device"
      :accessId='accessId'
      :pluginId="pluginId"
      :internalId="internalId"
    />
  </a-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import InklingDevice from '../../../../../components/InklingDevice'
import { useDeviceIdMappingModal } from './useDeviceIdMappingModal'

defineOptions({ name: 'InklingModal' })
const props = defineProps<{ accessId?: string; id?: string; pluginId?: string; internalId?: string }>()
const emit = defineEmits<{ cancel: []; submit: [externalId: string] }>()
const { t: $t } = useI18n()
const { internalId, checkKey, loading, handleOk } = useDeviceIdMappingModal(props, id => emit('submit', id))
const handleCancel = () => emit('cancel')
</script>

<style scoped>
.device-mapping-identity { padding:12px 16px 0; border:1px solid var(--line); border-radius:var(--r-2); }
.device-mapping-identity__value { overflow-wrap:anywhere; font-variant-numeric:tabular-nums; }
.device-mapping-identity__value.is-empty,.device-mapping-hint { color:var(--jet-theme-text-description); }
.device-mapping-hint { margin:8px 0 16px; font-size:12px; }
</style>
