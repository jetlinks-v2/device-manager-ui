<template>
  <a-drawer v-model:open="visible" title="占用详情" width="780px">
    <template v-if="wsInfo">
      <div class="detail-overview">
        <div class="detail-overview__title">{{ wsInfo.name }}</div>
        <div class="detail-overview__subtitle">{{ wsInfo.code }}｜{{ wsInfo.areaName }}</div>
      </div>
      <div class="section-title" style="margin-top: 16px">占用设备（{{ detailList.length }} 台）</div>
      <template v-if="detailList.length">
        <a-table :columns="columns" :data-source="detailList" row-key="id" size="small" :loading="loading" :pagination="detailList.length > 10 ? { pageSize: 10, showSizeChanger: false } : false">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'createdAt'">{{ formatTime(record.createTime) }}</template>
            <template v-if="column.key === 'action'">
              <a-popconfirm title="确认解除该设备的占用？" ok-text="确认" cancel-text="取消" @confirm="releaseDevice(record.id)">
                <a-button type="link" danger size="small" style="padding: 0">解除</a-button>
              </a-popconfirm>
            </template>
          </template>
        </a-table>
      </template>
      <a-empty v-else description="该工位已无占用设备" style="margin-top: 40px" />
    </template>
  </a-drawer>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import { formatTime } from '../utils'
import { queryLock, releaseLockById } from '../api/deviceLock'
import { getWorkstationDetail } from '../api/workstation'
import { useResourceStore } from '../useResourceStore'

const emit = defineEmits(['success'])
const store = useResourceStore()
const visible = ref(false)
const loading = ref(false)
const wsInfo = ref<{ code: string; name: string; areaName: string } | null>(null)
const detailList = ref<any[]>([])
const currentWsId = ref('')

const columns = [
  { title: '设备编号', dataIndex: 'deviceCode', key: 'deviceCode', width: 140 },
  { title: '设备名称', dataIndex: 'deviceName', key: 'deviceName', ellipsis: true },
  { title: '用途', dataIndex: 'reason', key: 'reason', ellipsis: true },
  { title: '申请时间', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 80, fixed: 'right' }
]

const loadList = async (wsId: string) => {
  loading.value = true
  try {
    const resp = await queryLock({
      pageSize: 100,
      terms: [{ column: 'workstationId', termType: 'eq', value: wsId }],
      sorts: [{ name: 'createTime', order: 'desc' }]
    })
    detailList.value = resp.result?.data || []
  } catch { detailList.value = [] } finally { loading.value = false }
}

const releaseDevice = async (lockId: string) => {
  try {
    await releaseLockById(lockId)
    message.success('已解除该设备占用')
    loadList(currentWsId.value)
    emit('success')
  } catch { message.error('解除失败') }
}

const open = async (wsId: string) => {
  currentWsId.value = wsId
  wsInfo.value = null
  detailList.value = []
  visible.value = true
  try {
    const resp = await getWorkstationDetail(wsId)
    const ws = resp.result
    wsInfo.value = { code: ws?.code || '-', name: ws?.name || '-', areaName: store.getAreaName(ws?.areaId || '') }
  } catch { wsInfo.value = { code: '-', name: '-', areaName: '-' } }
  loadList(wsId)
}
defineExpose({ open })
</script>

<style scoped lang="less">
.detail-overview { padding: 20px; border-radius: 8px; background: linear-gradient(180deg, #fafcff 0%, #ffffff 100%); border: 1px solid #f0f5ff; }
.detail-overview__title { font-size: 18px; font-weight: 600; }
.detail-overview__subtitle { margin-top: 4px; color: rgba(0, 0, 0, 0.45); }
.section-title { font-size: 14px; font-weight: 600; color: rgba(0, 0, 0, 0.88); margin-bottom: 8px; padding-left: 8px; border-left: 3px solid #1677ff; }
</style>
