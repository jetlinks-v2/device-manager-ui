<template>
  <j-page-container>
    <pro-search :columns="searchColumns" target="test-resource-control-log" @search="handleSearch" />
    <FullPage>
      <j-pro-table ref="tableRef" :columns="columns" :request="queryControlLog" :params="params">
        <template #headerRightRender><a-space :size="16"><a-badge status="success" :text="`成功 ${logCount.successCount}`" /><a-badge status="error" :text="`失败 ${logCount.errorCount}`" /></a-space></template>
        <template #workstationName="slotProps">{{ store.getWorkstationCode(slotProps.workstationId) }}｜{{ store.getWorkstationName(slotProps.workstationId) }}</template>
        <template #deviceName="slotProps">{{ slotProps.deviceName || slotProps.deviceId }}</template>
        <template #modelType="slotProps">{{ slotProps.modelType === 'function' ? '功能' : '属性' }}</template>
        <template #status="slotProps"><a-badge :status="slotProps.status === 'success' ? 'success' : 'error'" :text="slotProps.status === 'success' ? '成功' : '失败'" /></template>
        <template #createdAt="slotProps">{{ formatTime(slotProps.createTime) }}</template>
      </j-pro-table>
    </FullPage>
  </j-page-container>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { formatTime } from '../utils'
import { queryControlLog, countControlLog } from '../api/controlLog'
import { useResourceStore } from '../useResourceStore'

const store = useResourceStore()
const params = ref<Record<string, any>>({})
const tableRef = ref()
const logCount = reactive({ successCount: 0, errorCount: 0 })

const searchColumns = [
  { title: '工位', dataIndex: 'workstationId', key: 'workstationId', search: { type: 'select', options: store.workstationOptions, first: true } },
  { title: '状态', dataIndex: 'status', key: 'status', search: { type: 'select', options: [{ label: '成功', value: 'success' }, { label: '失败', value: 'error' }] } }
]
const columns = [
  { title: '工位', dataIndex: 'workstationName', key: 'workstationName', scopedSlots: true },
  { title: '设备', dataIndex: 'deviceName', key: 'deviceName', scopedSlots: true },
  { title: '物模型类型', dataIndex: 'modelType', key: 'modelType', scopedSlots: true, width: 110 },
  { title: '物模型项', dataIndex: 'modelId', key: 'modelId' },
  { title: '状态', dataIndex: 'status', key: 'status', scopedSlots: true, width: 90 },
  { title: '结果', dataIndex: 'message', key: 'message', ellipsis: true },
  { title: '时间', dataIndex: 'createTime', key: 'createdAt', scopedSlots: true, width: 180 }
]

const loadCount = async () => {
  try {
    const resp = await countControlLog(params.value)
    Object.assign(logCount, resp.result || {})
  } catch { /* ignore */ }
}

const handleSearch = (value: Record<string, any>) => {
  params.value = value
  tableRef.value?.reload()
  loadCount()
}

onMounted(() => { loadCount() })
</script>
