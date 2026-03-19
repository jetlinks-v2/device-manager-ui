<template>
  <pro-search
    :columns="searchColumns"
    target="workstation-control-log"
    @search="handleSearch"
    style="padding: 0"
    :saveButton="false"
  />
  <JProTable
    ref="tableRef"
    :columns="columns"
    :request="queryList"
    mode="TABLE"
    :params="params"
    :bodyStyle="{ padding: 0, minHeight: 'auto' }"
  >
    <template #headerRightRender>
      <a-space :size="16">
        <a-badge status="success" :text="`成功 ${logCount.successCount}`" />
        <a-badge status="error" :text="`失败 ${logCount.errorCount}`" />
      </a-space>
    </template>
    <template #deviceName="slotProps">
      <j-ellipsis style="width: calc(100% - 20px)">
        {{ slotProps.deviceName || slotProps.deviceId }}
      </j-ellipsis>
    </template>
    <template #modelType="slotProps">
      {{ slotProps.modelType === 'function' ? '功能' : '属性' }}
    </template>
    <template #status="slotProps">
      <a-badge
        :status="slotProps.status === 'success' ? 'success' : 'error'"
        :text="slotProps.status === 'success' ? '成功' : '失败'"
      />
    </template>
    <template #createdAt="slotProps">
      {{ formatTime(slotProps.createTime) }}
    </template>
    <template #action="slotProps">
      <a-button type="link" style="padding: 0" @click="viewDetail(slotProps)">
        <template #icon><AIcon type="SearchOutlined" /></template>
      </a-button>
    </template>
  </JProTable>
</template>

<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue'
import { Modal, Textarea } from 'ant-design-vue'
import { formatTime } from '../../utils'
import { queryControlLog, countControlLog } from '../../api/controlLog'

const props = defineProps<{ workstationId: string }>()
const tableRef = ref()
const params = ref<Record<string, any>>({})
const logCount = reactive({ successCount: 0, errorCount: 0 })

const searchColumns = [
  { title: '设备', dataIndex: 'deviceName', key: 'deviceName', search: { type: 'string', first: true } },
  { title: '状态', dataIndex: 'status', key: 'status', search: { type: 'select', options: [{ label: '成功', value: 'success' }, { label: '失败', value: 'error' }] } }
]
const columns = [
  { title: '设备', dataIndex: 'deviceName', key: 'deviceName', scopedSlots: true, ellipsis: true },
  { title: '物模型类型', dataIndex: 'modelType', key: 'modelType', scopedSlots: true, width: 110 },
  { title: '物模型项', dataIndex: 'modelId', key: 'modelId' },
  { title: '状态', dataIndex: 'status', key: 'status', scopedSlots: true, width: 90 },
  { title: '结果', dataIndex: 'message', key: 'message', ellipsis: true },
  { title: '时间', dataIndex: 'createTime', key: 'createdAt', scopedSlots: true, width: 180 },
  { title: '操作', key: 'action', width: 60, scopedSlots: true }
]

const queryList = (reqParams: Record<string, any>) => {
  const terms = [...(reqParams.terms || [])]
  terms.push({ column: 'workstationId', termType: 'eq', value: props.workstationId })
  return queryControlLog({ ...reqParams, terms })
}

const loadCount = async () => {
  try {
    const resp = await countControlLog({
      terms: [{ column: 'workstationId', termType: 'eq', value: props.workstationId }]
    })
    Object.assign(logCount, resp.result || {})
  } catch { /* ignore */ }
}

const handleSearch = (val: Record<string, any>) => {
  params.value = val
  tableRef.value?.reload()
  loadCount()
}

const viewDetail = (record: any) => {
  Modal.info({
    title: '控制详情',
    width: 600,
    content: h('div', [
      h('p', `设备：${record.deviceName || record.deviceId}`),
      h('p', `类型：${record.modelType === 'function' ? '功能调用' : '属性写入'}`),
      h('p', `物模型项：${record.modelId}`),
      h('p', `状态：${record.status === 'success' ? '成功' : '失败'}`),
      h('p', `结果：${record.message || '-'}`),
      record.requestPayload
        ? h(Textarea, { value: record.requestPayload, autoSize: { minRows: 3, maxRows: 8 }, readonly: true, style: 'margin-top: 8px' })
        : null
    ])
  })
}

onMounted(() => { loadCount() })
</script>
