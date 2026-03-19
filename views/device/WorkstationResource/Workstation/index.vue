<template>
  <j-page-container>
    <a-row :gutter="24" style="margin-bottom: 16px; display: flex; align-items: stretch">
      <a-col :span="6" style="display: flex"><TopCard style="flex: 1" :title="texts.deviceCount" :img="device.deviceNumber" :value="overview.platformDeviceCount" :footer="deviceFooter" /></a-col>
      <a-col :span="6" style="display: flex"><div class="top-card" style="flex: 1"><div class="top-card-content"><div class="content-left"><div class="content-left-title">{{ texts.workstationCount }}</div><div class="content-left-value">{{ overview.workstationCount }}</div></div><div class="content-right"><AIcon type="ClusterOutlined" /></div></div><div class="top-card-footer"><span>{{ texts.boundDeviceCount }}</span><div class="footer-item-value">{{ overview.deviceCount }}</div></div></div></a-col>
      <a-col :span="6" style="display: flex"><div class="top-card" style="flex: 1"><div class="top-card-content"><div class="content-left"><div class="content-left-title">{{ texts.occupiedDevices }}</div><div class="content-left-value">{{ overview.occupiedDeviceCount }}</div></div><div class="content-right warning"><AIcon type="HourglassOutlined" /></div></div><div class="top-card-footer"><a-badge status="processing" :text="texts.occupiedRate" /><div class="footer-item-value">{{ overview.occupiedRate }}%</div></div></div></a-col>
      <a-col :span="6" style="display: flex"><div class="top-card" style="flex: 1"><div class="top-card-content"><div class="content-left"><div class="content-left-title">{{ texts.idleDevices }}</div><div class="content-left-value">{{ overview.idleDeviceCount }}</div></div><div class="content-right success"><AIcon type="CheckCircleOutlined" /></div></div><div class="top-card-footer"><a-badge status="success" :text="texts.idleRate" /><div class="footer-item-value">{{ overview.idleRate }}%</div></div></div></a-col>
    </a-row>
    <pro-search :columns="columns" target="test-resource-workstation" @search="handleSearch" />
    <FullPage>
      <j-pro-table ref="tableRef" :columns="columns" :request="queryWorkstation" :params="params" modeValue="CARD" :gridColumn="3" :defaultParams="{ sorts: [{ name: 'createTime', order: 'desc' }] }">
        <template #headerLeftRender><j-permission-button type="primary" @click="handleAdd"><template #icon><AIcon type="PlusOutlined" /></template>{{ texts.addWorkstation }}</j-permission-button></template>
        <template #card="slotProps"><CardBox :value="slotProps" :actions="getActions(slotProps)" @click="goDetail(slotProps.id)"><template #img><Image :src="slotProps.photoUrl || defaultImage" class="card-list-img-80" /></template><template #content>
                <j-ellipsis style="width: calc(100% - 100px); margin-bottom: 18px">
                  <span class="card-title">{{ slotProps.name }}</span>
                </j-ellipsis>
                <a-row>
                  <a-col :span="12">
                    <div class="card-item-content-text">{{ texts.workstationCode }}</div>
                    <div>{{ slotProps.code }}</div>
                  </a-col>
                  <a-col :span="12">
                    <div class="card-item-content-text">{{ texts.areaBelong }}</div>
                    <j-ellipsis style="width: 100%">{{ slotProps.areaName || '-' }}</j-ellipsis>
                  </a-col>
                </a-row>
                <a-row style="margin-top: 8px">
                  <a-col :span="24">
                    <div class="card-item-content-text">说明</div>
                    <j-ellipsis style="width: 100%">{{ slotProps.remark || '-' }}</j-ellipsis>
                  </a-col>
                </a-row>
              </template><template #actions="item"><j-permission-button type="link" :danger="item.key === 'delete'" :popConfirm="item.popConfirm" @click.stop="item.onClick"><AIcon :type="item.icon" /><span>{{ item.text }}</span></j-permission-button></template></CardBox></template>
        <template #areaName="slotProps">{{ slotProps.areaName || '-' }}</template>
        <template #action="slotProps"><a-space :size="16"><template v-for="item in getActions(slotProps)" :key="item.key"><j-permission-button type="link" style="padding: 0 5px" :danger="item.key === 'delete'" :popConfirm="item.popConfirm" @click="item.onClick"><template #icon><AIcon :type="item.icon" /></template></j-permission-button></template></a-space></template>
      </j-pro-table>
    </FullPage>
    <Save ref="saveRef" @success="reload" />
  </j-page-container>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { device } from '@device-manager-ui/assets'
import { queryWorkstation } from '../api/workstation'
import { deleteWorkstation } from '../api/workstation'
import { getOverview } from '../api/dashboard'
import { useMenuStore } from '@/store'
import { useResourceStore } from '../useResourceStore'
import type { ActionItem } from '../types'
import Save from './Save.vue'
import TopCard from '../../DashBoard/components/TopCard.vue'

const texts = {
  workstationCount: '工位总数', areaCount: '所属区域数', deviceCount: '设备总数',
  boundDeviceCount: '绑定设备数',
  avgDevices: '平均每工位设备', occupiedDevices: '设备占用中', occupiedRate: '占用率',
  idleDevices: '设备空闲', idleRate: '空闲率', addWorkstation: '新增工位',
  workstationCode: '工位编号', areaBelong: '所属区域', view: '查看', edit: '编辑',
  delete: '删除', deleteConfirm: '确认删除该工位？',
  online: '在线', offline: '离线'
} as const

const menuStore = useMenuStore()
const store = useResourceStore()
const tableRef = ref()
const saveRef = ref()
const params = ref<Record<string, any>>({})
const defaultImage = device.deviceCard
const overview = reactive({
  workstationCount: 0, areaCount: 0, deviceCount: 0, avgDevicesPerWorkstation: 0,
  occupiedDeviceCount: 0, occupiedRate: 0, idleDeviceCount: 0, idleRate: 0,
  platformDeviceCount: 0, platformOnlineCount: 0, platformOfflineCount: 0
})
const deviceFooter = computed(() => [
  { title: texts.online, value: overview.platformOnlineCount, status: 'success' as const },
  { title: texts.offline, value: overview.platformOfflineCount, status: 'default' as const }
])

const goDetail = (id: string) => {
  menuStore.routerPush('device/WorkstationResource/Workstation/Detail', { params: { id } })
}

const columns = [
  { title: texts.workstationCode, dataIndex: 'code', key: 'code', search: { type: 'string', first: true } },
  { title: '工位名称', dataIndex: 'name', key: 'name', search: { type: 'string' } },
  { title: texts.areaBelong, dataIndex: 'areaName', key: 'areaName', scopedSlots: true },
  { title: '说明', dataIndex: 'remark', key: 'remark', ellipsis: true },
  { title: '操作', key: 'action', width: 160, fixed: 'right', scopedSlots: true }
]

const loadOverview = async () => {
  try {
    const resp = await getOverview()
    Object.assign(overview, resp.result || {})
  } catch { /* ignore */ }
}

const handleSearch = (value: Record<string, any>) => { params.value = value }
const handleAdd = () => saveRef.value?.open('create')
const reload = () => { tableRef.value?.reload(); loadOverview(); store.refreshWorkstationOptions() }

const getActions = (record: any): ActionItem[] => [
  { key: 'view', text: texts.view, icon: 'EyeOutlined', onClick: () => goDetail(record.id) },
  { key: 'edit', text: texts.edit, icon: 'EditOutlined', onClick: () => saveRef.value?.open('edit', record.id) },
  { key: 'delete', text: texts.delete, icon: 'DeleteOutlined', onClick: () => undefined, popConfirm: { title: texts.deleteConfirm, onConfirm: async () => { await deleteWorkstation(record.id); reload() } } }
]

onMounted(() => { loadOverview() })
</script>

<style scoped lang="less">
.top-card { display: flex; flex-direction: column; padding: 24px; background-color: #fff; border: 1px solid #e0e4e8; border-radius: 2px; .top-card-content { display: flex; justify-content: space-between; flex-grow: 1; } .content-left-title { color: rgba(0, 0, 0, 0.64); } .content-left-value { padding: 12px 0; color: #323130; font-weight: 700; font-size: 36px; line-height: 1; } .content-right { width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 26px; background: linear-gradient(135deg, #4c95ff 0%, #2f54eb 100%); } .content-right.warning { background: linear-gradient(135deg, #ffb85c 0%, #fa8c16 100%); } .content-right.success { background: linear-gradient(135deg, #63e6be 0%, #13c2c2 100%); } .top-card-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 16px; border-top: 1px solid #f0f0f0; } .footer-item-value { color: #323130; font-weight: 700; font-size: 16px; } }
.card-title { font-size: 16px; font-weight: 600; }
.card-item-content-text { color: rgba(0, 0, 0, 0.45); font-size: 12px; line-height: 20px; }
</style>
