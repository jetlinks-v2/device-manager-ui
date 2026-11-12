<template>
  <a-modal
    :title="$t('DeviceAccess.metadataModal.306037-0')"
    open
    width="900px"
    :okText="$t('DeviceAccess.metadataModal.306037-1')"
    :cancelText="$t('DeviceAccess.metadataModal.306037-2')"
    :confirmLoading='loading'
    :closable="!loading" :maskClosable="!loading" :keyboard="!loading"
    :cancelButtonProps="{ disabled: loading }"
    @ok="submitData"
    @cancel="cancel"
  >
    <div class='tip'>
      <a-icon type='ExclamationCircleOutlined'/>
      {{ $t('DeviceAccess.metadataModal.306037-3') }}
      <span style='font-weight: bold;padding:0 4px;'>{{ $t('DeviceAccess.metadataModal.306037-4') }}</span>
      {{ $t('DeviceAccess.metadataModal.306037-5') }}
      <a-tooltip :title="$t('DeviceAccess.metadataModal.306037-6')">
        <a-icon type='QuestionCircleOutlined' />
      </a-tooltip>
    </div>
    <a-form :layout="'vertical'" ref='formRef' :model='handleData'>
      <a-form-item name="type" :label="$t('DeviceAccess.metadataModal.306037-7')" :rules="[{ required: true, message: $t('DeviceAccess.metadataModal.306037-8')}]" >
        <j-card-select
          v-model:value="handleData.type"
          :column='4'
          :options="options"
        >
          <template #image='{image}'>
            <img :src='image' />
          </template>
        </j-card-select>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script lang="ts" setup>
import type { PropType } from 'vue'
import type { AccessSaveData } from './accessState'
import { useProductAccessMetadata } from './hooks/useProductAccessMetadata'

defineOptions({ name: 'MetadataModal' })
const props = defineProps({ data: { type: Object as PropType<AccessSaveData>, required: true } })
const emit = defineEmits<{ (event: 'submit'): void; (event: 'cancel'): void }>()
const { formRef, handleData, loading, options, submitData, cancel } = useProductAccessMetadata(props, emit)
</script>

<style scoped lang='less'>
.tip {
  background: #F6F6F6;
  color: #999;
  padding: 10px 26px;
  margin-bottom: 24px;
}
:deep(.j-card-item) {
  padding: 16px !important;
}
</style>
