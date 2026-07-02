<template>
  <div class="device-document-page">
    <div class="device-document-toolbar">
      <div class="device-document-toolbar__title">
        {{ $t('DeviceDocument.index.000001-0') }}
        <span class="device-document-toolbar__count">{{ documents.length }}</span>
      </div>
      <j-permission-button
        type="primary"
        hasPermission="device/Instance:update"
        @click="openCreate"
      >
        <template #icon>
          <AIcon type="PlusOutlined" />
        </template>
        {{ $t('DeviceDocument.index.000001-1') }}
      </j-permission-button>
    </div>
    <a-table
      rowKey="id"
      size="middle"
      :loading="loading"
      :columns="columns"
      :dataSource="documents"
      :pagination="false"
      :scroll="{ x: 860 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <div class="device-document-name">
            <AIcon type="FileTextOutlined" />
            <span>{{ record.name || fileName(record) }}</span>
          </div>
        </template>
        <template v-else-if="column.key === 'documentType'">
          <a-tag>{{ documentTypeText(record.documentType) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'fileId'">
          <j-ellipsis>{{ record.fileId }}</j-ellipsis>
        </template>
        <template v-else-if="column.key === 'createTime'">
          {{ record.createTime ? dayjs(record.createTime).format('YYYY-MM-DD HH:mm:ss') : '-' }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button
              type="link"
              style="padding: 0"
              :title="$t('DeviceDocument.index.000001-11')"
              :aria-label="$t('DeviceDocument.index.000001-11')"
              @click="openFile(record)"
            >
              <template #icon>
                <AIcon type="EyeOutlined" />
              </template>
            </a-button>
            <j-permission-button
              type="link"
              style="padding: 0; margin: 0"
              hasPermission="device/Instance:update"
              :title="$t('DeviceDocument.index.000001-12')"
              :aria-label="$t('DeviceDocument.index.000001-12')"
              @click="openEdit(record)"
            >
              <template #icon>
                <AIcon type="EditOutlined" />
              </template>
            </j-permission-button>
            <j-permission-button
              type="link"
              danger
              style="padding: 0; margin: 0"
              hasPermission="device/Instance:delete"
              :title="$t('DeviceDocument.index.000001-13')"
              :aria-label="$t('DeviceDocument.index.000001-13')"
              :popConfirm="{
                title: $t('DeviceDocument.index.000001-2'),
                onConfirm: () => removeDocument(record)
              }"
            >
              <template #icon>
                <AIcon type="DeleteOutlined" />
              </template>
            </j-permission-button>
          </a-space>
        </template>
      </template>
      <template #emptyText>
        <j-empty :description="$t('DeviceDocument.index.000001-3')" />
      </template>
    </a-table>
    <SaveModal
      v-if="editor.visible"
      :data="editor.current"
      :documentTypes="documentTypeOptions"
      :saving="editor.saving"
      @close="editor.visible = false"
      @save="saveDocument"
    />
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import { getFileUrlById } from '@jetlinks-web-core/api/comm'
import {
  deleteDeviceDocument,
  queryDeviceDocuments,
  saveDeviceDocuments
} from '../../../../../api/instance'
import { useInstanceStore } from '../../../../../store/instance'
import SaveModal from './SaveModal.vue'

const { t: $t } = useI18n()
const instanceStore = useInstanceStore()
const loading = ref(false)
const documents = ref<Record<string, any>[]>([])
const editor = reactive({
  visible: false,
  saving: false,
  current: undefined as Record<string, any> | undefined
})

const documentTypeOptions = computed(() => [
  { label: $t('DeviceDocument.type.accessGuide'), value: 'access-guide' },
  { label: $t('DeviceDocument.type.maintenance'), value: 'maintenance' },
  { label: $t('DeviceDocument.type.protocolDoc'), value: 'protocol-doc' },
  { label: $t('DeviceDocument.type.marketDoc'), value: 'market-doc' },
  { label: $t('DeviceDocument.type.other'), value: 'other' }
])

const columns = computed(() => [
  { title: $t('DeviceDocument.index.000001-4'), dataIndex: 'name', key: 'name', ellipsis: true },
  { title: $t('DeviceDocument.index.000001-5'), dataIndex: 'documentType', key: 'documentType', width: 150 },
  { title: $t('DeviceDocument.index.000001-6'), dataIndex: 'fileId', key: 'fileId', ellipsis: true },
  { title: $t('DeviceDocument.index.000001-7'), dataIndex: 'sortIndex', key: 'sortIndex', width: 100 },
  { title: $t('DeviceDocument.index.000001-8'), dataIndex: 'createTime', key: 'createTime', width: 180 },
  { title: $t('DeviceDocument.index.000001-9'), key: 'action', width: 150, fixed: 'right' }
])

const responseResult = (response: any) => response?.result ?? response?.data ?? response

const documentTypeText = (type: string) => (
  documentTypeOptions.value.find((item) => item.value === type)?.label || type || '-'
)

const fileName = (record: Record<string, any>) => {
  const fileId = String(record.fileId || '').split(/[?#]/)[0]
  return fileId.split(/[\\/]/).pop() || fileId || '-'
}

const loadDocuments = async () => {
  const deviceId = instanceStore.current?.id
  if (!deviceId) return
  loading.value = true
  try {
    const resp = await queryDeviceDocuments(deviceId, {
      paging: false,
      sorts: [
        { name: 'sortIndex', order: 'asc' },
        { name: 'createTime', order: 'desc' }
      ]
    })
    const data = responseResult(resp)
    documents.value = Array.isArray(data) ? data : []
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  editor.current = undefined
  editor.visible = true
}

const openEdit = (record: Record<string, any>) => {
  editor.current = { ...record, fileName: fileName(record) }
  editor.visible = true
}

const openFile = (record: Record<string, any>) => {
  if (record.fileId) {
    window.open(getFileUrlById(String(record.fileId)), '_blank')
  }
}

const saveDocument = async (data: Record<string, any>) => {
  const deviceId = instanceStore.current?.id
  if (!deviceId) return
  editor.saving = true
  try {
    await saveDeviceDocuments(deviceId, [data])
    onlyMessage($t('DeviceDocument.index.000001-10'), 'success')
    editor.visible = false
    await loadDocuments()
  } finally {
    editor.saving = false
  }
}

const removeDocument = async (record: Record<string, any>) => {
  const deviceId = instanceStore.current?.id
  if (!deviceId || !record.id) return
  await deleteDeviceDocument(deviceId, record.id)
  onlyMessage($t('DeviceDocument.index.000001-10'), 'success')
  await loadDocuments()
}

watch(
  () => instanceStore.current?.id,
  () => loadDocuments(),
  { immediate: true }
)
</script>

<style scoped lang="less">
.device-document-page {
  height: 100%;
}

.device-document-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.device-document-toolbar__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}

.device-document-toolbar__count {
  color: rgba(0, 0, 0, 0.45);
  font-size: 13px;
  font-weight: 400;
}

.device-document-name {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
</style>
