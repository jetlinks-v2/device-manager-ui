<template>
  <a-modal
    :open="true"
    :title="isEdit ? $t('DeviceDocument.Save.000001-0') : $t('DeviceDocument.Save.000001-1')"
    :confirmLoading="saving"
    :maskClosable="false"
    @ok="handleOk"
    @cancel="emit('close')"
  >
    <a-form ref="formRef" :model="form" layout="vertical">
      <a-form-item
        name="documentType"
        :label="$t('DeviceDocument.Save.000001-2')"
        :rules="[{ required: true, message: $t('DeviceDocument.Save.000001-3') }]"
      >
        <a-select
          v-model:value="form.documentType"
          :options="documentTypes"
          :disabled="isEdit"
          :placeholder="$t('DeviceDocument.Save.000001-3')"
        />
      </a-form-item>
      <a-form-item
        name="name"
        :label="$t('DeviceDocument.Save.000001-4')"
        :rules="[{ required: true, message: $t('DeviceDocument.Save.000001-5') }]"
      >
        <a-input
          v-model:value="form.name"
          :placeholder="$t('DeviceDocument.Save.000001-5')"
          :maxlength="128"
        />
      </a-form-item>
      <a-form-item
        name="fileId"
        :label="$t('DeviceDocument.Save.000001-6')"
        :rules="[{ required: true, message: $t('DeviceDocument.Save.000001-7') }]"
      >
        <a-upload
          name="file"
          :action="FileStaticPath()"
          :headers="getUploadHeaders()"
          :maxCount="1"
          :fileList="fileList"
          :showUploadList="true"
          @change="handleUploadChange"
          @remove="handleRemove"
        >
          <a-button>
            <template #icon>
              <AIcon type="UploadOutlined" />
            </template>
            {{ form.fileId ? $t('DeviceDocument.Save.000001-8') : $t('DeviceDocument.Save.000001-9') }}
          </a-button>
        </a-upload>
      </a-form-item>
      <a-form-item
        name="sortIndex"
        :label="$t('DeviceDocument.Save.000001-10')"
      >
        <a-input-number
          v-model:value="form.sortIndex"
          style="width: 100%"
          :min="0"
          :precision="0"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import type { UploadChangeParam } from 'ant-design-vue'
import { onlyMessage } from '@jetlinks-web/utils'
import { FileStaticPath } from '@jetlinks-web-core/api/comm'
import { getUploadHeaders } from '@jetlinks-web-core/utils'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  data?: Record<string, any>
  documentTypes: Array<{ label: string; value: string }>
  saving?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', data: Record<string, any>): void
}>()

const { t: $t } = useI18n()
const formRef = ref()
const isEdit = computed(() => !!props.data?.id)
const form = reactive({
  documentType: '',
  name: '',
  fileId: '',
  sortIndex: 0
})
const fileList = ref<any[]>([])

const resolveFileId = (result: Record<string, any>) => {
  const raw = result.id || result.fileId || result.url || result.accessUrl || ''
  const text = String(raw).trim()
  const marker = '/file/'
  const index = text.indexOf(marker)
  if (index < 0) return text

  const fileId = text.slice(index + marker.length).split(/[?#]/)[0]
  try {
    return decodeURIComponent(fileId)
  } catch {
    return fileId
  }
}

watch(
  () => props.data,
  (data) => {
    form.documentType = data?.documentType || ''
    form.name = data?.name || ''
    form.fileId = data?.fileId || ''
    form.sortIndex = Number(data?.sortIndex ?? 0)
    fileList.value = form.fileId
      ? [{
        uid: form.fileId,
        name: data?.fileName || data?.name || form.fileId,
        status: 'done'
      }]
      : []
  },
  { immediate: true }
)

const handleUploadChange = (info: UploadChangeParam) => {
  fileList.value = info.fileList.slice(-1)
  if (info.file.status === 'done') {
    const result = info.file.response?.result || info.file.response || {}
    form.fileId = resolveFileId(result)
    const fileName = result.filename || result.name || info.file.name
    if (!form.name) {
      form.name = fileName
    }
    fileList.value = [{
      ...info.file,
      uid: form.fileId || info.file.uid,
      name: fileName,
      status: 'done'
    }]
    onlyMessage($t('DeviceDocument.Save.000001-11'), 'success')
  } else if (info.file.status === 'error') {
    onlyMessage(info.file.response?.message || info.file.error?.message || $t('DeviceDocument.Save.000001-12'), 'error')
  }
}

const handleRemove = () => {
  form.fileId = ''
  fileList.value = []
  return true
}

const handleOk = async () => {
  await formRef.value?.validate()
  emit('save', {
    ...props.data,
    documentType: form.documentType,
    name: form.name,
    fileId: form.fileId,
    sortIndex: Number(form.sortIndex || 0)
  })
}
</script>
