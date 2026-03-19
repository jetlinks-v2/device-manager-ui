<template>
  <a-modal v-model:open="visible" title="编辑占用" :maskClosable="false" destroy-on-close width="720px" :confirmLoading="loading" @ok="handleSubmit">
    <a-alert type="info" show-icon style="margin-bottom: 16px" message="编辑占用设备" description="移除的设备将立即释放占用锁；新增的设备将立即锁定到当前工位。" />
    <a-descriptions :column="3" size="small" bordered style="margin-bottom: 16px">
      <a-descriptions-item label="工位编号">{{ wsInfo.code }}</a-descriptions-item>
      <a-descriptions-item label="工位名称">{{ wsInfo.name }}</a-descriptions-item>
      <a-descriptions-item label="所属区域">{{ wsInfo.areaName }}</a-descriptions-item>
    </a-descriptions>
    <div class="section-title">当前占用设备（{{ currentList.length }} 台）</div>
    <a-table :columns="currentColumns" :data-source="displayList" :pagination="displayList.length > 10 ? { pageSize: 10 } : false" row-key="id" size="small" style="margin-bottom: 16px">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'createdAt'">{{ formatTime(record.createTime) }}</template>
        <template v-if="column.key === 'action'"><a-button type="link" danger size="small" @click="markRemove(record.id)">移除</a-button></template>
      </template>
    </a-table>
    <div class="section-title">新增占用设备</div>
    <a-select v-model:value="addDeviceIds" mode="multiple" show-search :filter-option="selectFilterOption" option-filter-prop="label" :options="availableDeviceOptions" :loading="optionsLoading" placeholder="从工位配套设备中选择（不含已占用）" style="width: 100%; margin-top: 8px" @focus="loadAvailableDevices" />
    <div v-if="addDeviceIds.length" style="margin-top: 8px; color: rgba(0,0,0,0.45); font-size: 12px">将新增占用 {{ addDeviceIds.length }} 台设备</div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { message } from 'ant-design-vue'
import { selectFilterOption, formatTime } from '../utils'
import { queryLock, batchReleaseLock, applyLock } from '../api/deviceLock'
import { getWorkstationDetail, queryWorkstationFreeDevices } from '../api/workstation'
import { useResourceStore } from '../useResourceStore'

const emit = defineEmits(['success'])
const store = useResourceStore()
const visible = ref(false)
const loading = ref(false)
const optionsLoading = ref(false)
const workstationId = ref('')
const wsInfo = ref<{ code: string; name: string; areaName: string }>({ code: '-', name: '-', areaName: '-' })
const currentList = ref<any[]>([])
const removeIds = ref<string[]>([])
const addDeviceIds = ref<string[]>([])
const availableDeviceOptions = ref<Array<{ label: string; value: string }>>([])

const displayList = computed(() => currentList.value.filter((item) => !removeIds.value.includes(item.id)))

const currentColumns = [
  { title: '设备编号', dataIndex: 'deviceCode', key: 'deviceCode', width: 140 },
  { title: '设备名称', dataIndex: 'deviceName', key: 'deviceName', ellipsis: true },
  { title: '占用用途', dataIndex: 'reason', key: 'reason', ellipsis: true },
  { title: '占用时间', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 80, fixed: 'right' }
]

const markRemove = (lockId: string) => { removeIds.value.push(lockId) }

const loadAvailableDevices = async () => {
  optionsLoading.value = true
  try {
    const resp = await queryWorkstationFreeDevices(workstationId.value, { pageIndex: 0, pageSize: 200 })
    const devices = resp.result?.data || []
    const occupiedDeviceIds = new Set(currentList.value.filter((l) => !removeIds.value.includes(l.id)).map((l) => l.deviceId))
    availableDeviceOptions.value = devices
      .filter((d: any) => !occupiedDeviceIds.has(d.id))
      .map((d: any) => ({ label: `${d.code || d.id}｜${d.name || d.id}`, value: d.id }))
  } catch { /* ignore */ } finally { optionsLoading.value = false }
}

const open = async (wsId: string) => {
  workstationId.value = wsId
  removeIds.value = []
  addDeviceIds.value = []
  availableDeviceOptions.value = []
  // 加载工位信息
  try {
    const resp = await getWorkstationDetail(wsId)
    const ws = resp.result
    wsInfo.value = { code: ws?.code || '-', name: ws?.name || '-', areaName: store.getAreaName(ws?.areaId || '') }
  } catch { wsInfo.value = { code: '-', name: '-', areaName: '-' } }
  // 加载当前占用列表
  try {
    const resp = await queryLock({ terms: [{ column: 'workstationId', termType: 'eq', value: wsId }], pageSize: 100 })
    currentList.value = resp.result?.data || []
  } catch { currentList.value = [] }
  visible.value = true
}

const handleSubmit = async () => {
  loading.value = true
  try {
    // 释放被移除的锁
    if (removeIds.value.length) {
      await batchReleaseLock({ lockIds: removeIds.value })
    }
    // 新增占用
    if (addDeviceIds.value.length) {
      await applyLock({ workstationId: workstationId.value, deviceIds: addDeviceIds.value, reason: '' })
    }
    message.success('编辑占用成功')
    visible.value = false
    emit('success')
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  } finally { loading.value = false }
}

defineExpose({ open })
</script>

<style scoped lang="less">
.section-title { font-size: 14px; font-weight: 600; color: rgba(0, 0, 0, 0.88); margin-bottom: 8px; padding-left: 8px; border-left: 3px solid #1677ff; }
</style>
