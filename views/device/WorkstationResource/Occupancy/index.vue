<template>
  <j-page-container>
    <a-row :gutter="24" style="margin-bottom: 16px">
      <a-col :span="6"><div class="top-card"><div class="top-card-content"><div class="content-left"><div class="content-left-title">{{ texts.occupiedStations }}</div><div class="content-left-value">{{ overview.occupiedWorkstationCount }}</div></div><div class="content-right warning"><AIcon type="LockOutlined" /></div></div><div class="top-card-footer"><span>{{ texts.workstationCount }}</span><div class="footer-item-value">{{ overview.workstationCount }}</div></div></div></a-col>
      <a-col :span="6"><div class="top-card"><div class="top-card-content"><div class="content-left"><div class="content-left-title">{{ texts.occupiedDevices }}</div><div class="content-left-value">{{ overview.occupiedDeviceCount }}</div></div><div class="content-right warning"><AIcon type="HourglassOutlined" /></div></div><div class="top-card-footer"><a-badge status="processing" :text="texts.occupiedRate" /><div class="footer-item-value">{{ overview.occupiedRate }}%</div></div></div></a-col>
      <a-col :span="6"><div class="top-card"><div class="top-card-content"><div class="content-left"><div class="content-left-title">{{ texts.idleDevices }}</div><div class="content-left-value">{{ overview.idleDeviceCount }}</div></div><div class="content-right success"><AIcon type="CheckCircleOutlined" /></div></div><div class="top-card-footer"><a-badge status="success" :text="texts.idleRate" /><div class="footer-item-value">{{ overview.idleRate }}%</div></div></div></a-col>
      <a-col :span="6"><div class="top-card"><div class="top-card-content"><div class="content-left"><div class="content-left-title">{{ texts.deviceCount }}</div><div class="content-left-value">{{ overview.deviceCount }}</div></div><div class="content-right"><AIcon type="DesktopOutlined" /></div></div><div class="top-card-footer"><span>{{ texts.areaCount }}</span><div class="footer-item-value">{{ overview.areaCount }}</div></div></div></a-col>
    </a-row>
    <pro-search :columns="searchColumns" target="test-resource-lock" @search="handleSearch" />
    <FullPage>
      <j-pro-table ref="tableRef" :columns="columns" :request="queryLockByWorkstation" :params="params" modeValue="CARD" :gridColumn="3">
        <template #headerLeftRender><j-permission-button type="primary" @click="openApply"><template #icon><AIcon type="PlusOutlined" /></template>{{ texts.applyLock }}</j-permission-button></template>
        <template #card="slotProps"><CardBox class="occupancy-card" :value="slotProps" :actions="getActions(slotProps)" status="processing" :statusText="texts.occupied" :statusNames="{ processing: 'processing' }" @click="openDetail(slotProps.workstationId)"><template #img><Image :src="slotProps.photoUrl || defaultImage" class="card-list-img-80" /></template><template #content>
                <j-ellipsis style="width: calc(100% - 100px); margin-bottom: 12px">
                  <span class="card-title">{{ slotProps.workstationName }}</span>
                </j-ellipsis>
                <a-space direction="vertical" style="width: 100%">
                  <a-typography-text type="secondary">
                    {{ slotProps.workstationCode }}｜{{ slotProps.areaName }}
                  </a-typography-text>
                  <a-row>
                    <a-col :span="12">
                      <div class="card-item-content-text">最近用途</div>
                      <div>{{ slotProps.reason || '-' }}</div>
                    </a-col>
                    <a-col :span="12">
                      <div class="card-item-content-text">{{ texts.latestApply }}</div>
                      <div>{{ formatTime(slotProps.createdAt) }}</div>
                    </a-col>
                  </a-row>
                </a-space>
              </template><template #actions="item"><j-permission-button type="link" :danger="item.key === 'release'" :popConfirm="item.popConfirm" @click.stop="item.onClick"><AIcon :type="item.icon" /><span>{{ item.text }}</span></j-permission-button></template></CardBox></template>
        <template #workstationName="slotProps">{{ slotProps.workstationCode }}｜{{ slotProps.workstationName }}</template>
        <template #createdAt="slotProps">{{ formatTime(slotProps.createdAt) }}</template>
        <template #status><a-badge status="processing" :text="texts.occupied" /></template>
        <template #action="slotProps"><a-space :size="16"><template v-for="item in getActions(slotProps)" :key="item.key"><j-permission-button type="link" style="padding: 0 5px" :danger="item.key === 'release'" :popConfirm="item.popConfirm" @click="item.onClick"><template #icon><AIcon :type="item.icon" /></template></j-permission-button></template></a-space></template>
      </j-pro-table>
    </FullPage>
    <ApplyLock ref="applyRef" @success="reload" />
    <EditLock ref="editRef" @success="reload" />
    <Detail ref="detailRef" @success="reload" />
  </j-page-container>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { device } from '@device-manager-ui/assets'
import { formatTime } from '../utils'
import { queryLockByWorkstation } from '../api/deviceLock'
import { releaseLockByWorkstation } from '../api/deviceLock'
import { getOverview } from '../api/dashboard'
import type { ActionItem } from '../types'
import ApplyLock from './ApplyLock.vue'
import Detail from './Detail.vue'
import EditLock from './EditLock.vue'

const texts = {
  occupiedStations: '占用工位数', workstationCount: '工位总数', occupiedDevices: '占用设备数', occupiedRate: '占用率', idleDevices: '空闲设备数', idleRate: '空闲率', deviceCount: '设备总数', areaCount: '区域总数', applyLock: '申请占用', occupied: '占用中', latestApply: '最近申请', view: '查看', edit: '编辑', release: '解除占用', releaseConfirm: '确认解除该工位的占用？'
} as const

const defaultImage = device.deviceProduct
const params = ref<Record<string, any>>({})
const tableRef = ref()
const applyRef = ref()
const editRef = ref()
const detailRef = ref()
const overview = reactive({
  occupiedWorkstationCount: 0, workstationCount: 0, occupiedDeviceCount: 0,
  occupiedRate: 0, idleDeviceCount: 0, idleRate: 0, deviceCount: 0, areaCount: 0
})

const searchColumns = [
  { title: '工位编号', dataIndex: 'workstationCode', key: 'workstationCode', search: { type: 'string', first: true } },
  { title: '工位名称', dataIndex: 'workstationName', key: 'workstationName', search: { type: 'string' } }
]
const columns = [
  { title: '工位', dataIndex: 'workstationName', key: 'workstationName', scopedSlots: true },
  { title: '状态', key: 'status', width: 120, scopedSlots: true },
  { title: '最近用途', dataIndex: 'reason', key: 'reason', ellipsis: true },
  { title: '申请时间', dataIndex: 'createdAt', key: 'createdAt', width: 180, scopedSlots: true },
  { title: '操作', key: 'action', width: 160, fixed: 'right', scopedSlots: true }
]

const loadOverview = async () => {
  try {
    const resp = await getOverview()
    Object.assign(overview, resp.result || {})
  } catch { /* ignore */ }
}

const handleSearch = (value: Record<string, any>) => { params.value = value }
const openApply = () => applyRef.value?.open()
const openDetail = (workstationId: string) => detailRef.value?.open(workstationId)
const reload = () => { tableRef.value?.reload(); loadOverview() }

const getActions = (record: any): ActionItem[] => [
  { key: 'view', text: texts.view, icon: 'EyeOutlined', onClick: () => openDetail(record.workstationId) },
  { key: 'edit', text: texts.edit, icon: 'EditOutlined', onClick: () => editRef.value?.open(record.workstationId) },
  { key: 'release', text: texts.release, icon: 'DisconnectOutlined', onClick: () => undefined, popConfirm: { title: texts.releaseConfirm, onConfirm: async () => { await releaseLockByWorkstation(record.workstationId); reload() } } }
]

onMounted(() => { loadOverview() })
</script>

<style scoped lang="less">
.top-card { display: flex; flex-direction: column; padding: 24px; background-color: #fff; border: 1px solid #e0e4e8; border-radius: 2px; .top-card-content { display: flex; justify-content: space-between; } .content-left-title { color: rgba(0, 0, 0, 0.64); } .content-left-value { padding: 12px 0; color: #323130; font-weight: 700; font-size: 36px; line-height: 1; } .content-right { width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 26px; background: linear-gradient(135deg, #4c95ff 0%, #2f54eb 100%); } .content-right.warning { background: linear-gradient(135deg, #ffb85c 0%, #fa8c16 100%); } .content-right.success { background: linear-gradient(135deg, #63e6be 0%, #13c2c2 100%); } .top-card-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 16px; border-top: 1px solid #f0f0f0; } .footer-item-value { color: #323130; font-weight: 700; font-size: 16px; } }
.card-title { font-size: 16px; font-weight: 600; }
.card-item-content-text { color: rgba(0, 0, 0, 0.45); font-size: 12px; line-height: 20px; }
</style>
