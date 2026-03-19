<template>
  <j-page-container
    :showBack="true"
    :tabList="tabList"
    :tabActiveKey="activeKey"
    @tabChange="handleTabChange"
  >
    <template #title>
      <div style="display: flex; align-items: center">
        <a-tooltip :title="detail?.name">
          <div class="workstation-detail__title">{{ detail?.name || '-' }}</div>
        </a-tooltip>
      </div>
    </template>

    <template #content>
      <a-descriptions size="small" :column="4">
        <a-descriptions-item label="ID">{{ detail?.id || '-' }}</a-descriptions-item>
        <a-descriptions-item label="工位编号">{{ detail?.code || '-' }}</a-descriptions-item>
        <a-descriptions-item label="所属区域">{{ detail?.areaName || '-' }}</a-descriptions-item>
        <a-descriptions-item label="配套设备">{{ detail?.deviceCount ?? '-' }} 台</a-descriptions-item>
      </a-descriptions>
    </template>

    <template #extra>
      <a-space>
        <a-tooltip title="刷新">
          <a-button type="text" @click="refresh">
            <AIcon type="ReloadOutlined" />
          </a-button>
        </a-tooltip>
      </a-space>
    </template>

    <FullPage>
      <div style="height: 100%; padding: 24px; overflow-y: auto">
        <DevicesTab v-if="activeKey === 'devices' && detail" :workstationId="detail.id" />
        <OccupancyTab v-else-if="activeKey === 'occupancy' && detail" :workstationId="detail.id" />
        <ControlTab v-else-if="activeKey === 'control' && detail" :workstationId="detail.id" />
        <ControlLogTab v-else-if="activeKey === 'controlLog' && detail" :workstationId="detail.id" />
      </div>
    </FullPage>
  </j-page-container>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getWorkstationDetail } from '../api/workstation'
import { useResourceStore } from '../useResourceStore'
import DevicesTab from './tabs/DevicesTab.vue'
import OccupancyTab from './tabs/OccupancyTab.vue'
import ControlTab from './tabs/ControlTab.vue'
import ControlLogTab from './tabs/ControlLogTab.vue'

const route = useRoute()
const store = useResourceStore()

const activeKey = ref<string>('devices')
const tabList = [
  { key: 'devices', tab: '配套设备' },
  { key: 'occupancy', tab: '工位占用' },
  { key: 'control', tab: '工位控制' },
  { key: 'controlLog', tab: '控制记录' }
]

const detail = ref<{
  id: string; code: string; name: string; areaName: string; deviceCount: number
} | null>(null)

const loadDetail = async () => {
  const id = String(route.params.id || '')
  if (!id) return
  try {
    const resp = await getWorkstationDetail(id)
    const ws = resp.result
    if (ws) {
      detail.value = {
        id: ws.id,
        code: ws.code,
        name: ws.name,
        areaName: store.getAreaName(ws.areaId) || ws.areaName || '-',
        deviceCount: ws.deviceIds?.length ?? 0
      }
    }
  } catch { /* ignore */ }
}

const handleTabChange = (key: string) => { activeKey.value = key || 'devices' }
const refresh = () => { loadDetail() }

watch(() => route.params.id, () => { loadDetail() })
onMounted(() => { loadDetail() })
</script>

<style scoped lang="less">
.workstation-detail__title {
  max-width: 520px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
