<template>
  <a-drawer v-model:open="visible" title="区域详情" width="760px">
    <template v-if="detail">
      <div class="detail-overview">
        <div class="detail-overview__main">
          <div class="detail-overview__title">{{ detail.name }}</div>
          <div class="detail-overview__subtitle">{{ detail.code }}</div>
          <div class="detail-overview__remark">{{ detail.remark || '暂无说明' }}</div>
        </div>
        <Image :src="detail.photoUrl || defaultImage" class="detail-overview__image" />
      </div>

      <div class="section-title" style="margin-top: 16px">工位列表（{{ wsList.length }} 个）</div>

      <a-table
        :columns="wsColumns"
        :data-source="wsList"
        row-key="id"
        size="small"
        :loading="wsLoading"
        :pagination="wsList.length > 10 ? { pageSize: 10, showSizeChanger: false } : false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'action'">
            <a-button type="link" size="small" style="padding: 0" @click="openWorkstationDetail(record.id)">
              查看
            </a-button>
          </template>
        </template>
      </a-table>
    </template>
  </a-drawer>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { device } from '@device-manager-ui/assets'
import { getAreaDetail } from '../api/area'
import { queryWorkstation } from '../api/workstation'
import { useMenuStore } from '@/store'

const menuStore = useMenuStore()
const visible = ref(false)
const defaultImage = device.deviceProduct
const wsLoading = ref(false)
const wsList = ref<any[]>([])

const detail = ref<{
  id: string; code: string; name: string; photoUrl?: string; remark?: string
} | null>(null)

const loadDetail = async (id: string) => {
  detail.value = null
  wsList.value = []
  try {
    const resp = await getAreaDetail(id)
    detail.value = resp.result || null
  } catch { /* ignore */ }
  // 加载区域下的工位
  wsLoading.value = true
  try {
    const resp = await queryWorkstation({
      pageSize: 100,
      terms: [{ column: 'areaId', termType: 'eq', value: id }],
      sorts: [{ name: 'code', order: 'asc' }]
    })
    wsList.value = resp.result?.data || []
  } catch { /* ignore */ } finally { wsLoading.value = false }
}

const wsColumns = [
  { title: '工位编号', dataIndex: 'code', key: 'code', width: 130 },
  { title: '工位名称', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '操作', key: 'action', width: 80, fixed: 'right' }
]

const openWorkstationDetail = (id: string) => {
  visible.value = false
  menuStore.routerPush('device/WorkstationResource/Workstation/Detail', { params: { id } })
}

const open = (id: string) => {
  visible.value = true
  loadDetail(id)
}
defineExpose({ open })
</script>

<style scoped lang="less">
.detail-overview {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  padding: 20px; border-radius: 8px; background: linear-gradient(180deg, #fafcff 0%, #ffffff 100%); border: 1px solid #f0f5ff;
}
.detail-overview__main { flex: 1; min-width: 0; }
.detail-overview__title { font-size: 18px; font-weight: 600; }
.detail-overview__subtitle { margin-top: 4px; color: rgba(0, 0, 0, 0.45); }
.detail-overview__remark { margin-top: 8px; color: rgba(0, 0, 0, 0.65); }
.detail-overview__image { width: 88px; height: 88px; border-radius: 8px; overflow: hidden; }
.section-title { font-size: 14px; font-weight: 600; color: rgba(0, 0, 0, 0.88); margin-bottom: 8px; padding-left: 8px; border-left: 3px solid #1677ff; }
</style>
