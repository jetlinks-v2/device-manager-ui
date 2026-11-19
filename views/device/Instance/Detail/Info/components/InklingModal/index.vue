<template>
  <a-modal
    centered
    :width="800"
    :mask-closable="false"
    :open="true"
    :title="$t('InklingModal.index.380043-0')"
    :confirmLoading="loading"
    @ok="handleOk"
    @cancel="handleCancel"
  >
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

</style>
