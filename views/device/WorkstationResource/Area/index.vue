<template>
  <j-page-container>
    <a-row :gutter="24" style="margin-bottom: 16px; display: flex; align-items: stretch">
      <a-col :span="6" style="display: flex"><TopCard style="flex: 1" title="设备总数" :img="device.deviceNumber" :value="overview.platformDeviceCount" :footer="deviceFooter" /></a-col>
      <a-col :span="6" style="display: flex"><div class="top-card" style="flex: 1"><div class="top-card-content"><div class="content-left"><div class="content-left-title">区域总数</div><div class="content-left-value">{{ overview.areaCount }}</div></div><div class="content-right"><AIcon type="ApartmentOutlined" /></div></div><div class="top-card-footer"><span>工位总数</span><div class="footer-item-value">{{ overview.workstationCount }}</div></div></div></a-col>
      <a-col :span="6" style="display: flex"><div class="top-card" style="flex: 1"><div class="top-card-content"><div class="content-left"><div class="content-left-title">设备占用中</div><div class="content-left-value">{{ overview.occupiedDeviceCount }}</div></div><div class="content-right warning"><AIcon type="HourglassOutlined" /></div></div><div class="top-card-footer"><a-badge status="processing" text="占用率" /><div class="footer-item-value">{{ overview.occupiedRate }}%</div></div></div></a-col>
      <a-col :span="6" style="display: flex"><div class="top-card" style="flex: 1"><div class="top-card-content"><div class="content-left"><div class="content-left-title">设备空闲</div><div class="content-left-value">{{ overview.idleDeviceCount }}</div></div><div class="content-right success"><AIcon type="CheckCircleOutlined" /></div></div><div class="top-card-footer"><a-badge status="success" text="空闲率" /><div class="footer-item-value">{{ overview.idleRate }}%</div></div></div></a-col>
    </a-row>
    <pro-search :columns="columns" target="test-resource-area" @search="handleSearch" />
    <FullPage><j-pro-table ref="tableRef" :columns="columns" :request="queryArea" :params="params" modeValue="CARD" :gridColumn="3" :defaultParams="{ sorts: [{ name: 'createTime', order: 'desc' }] }"><template #headerLeftRender><j-permission-button type="primary" @click="handleAdd"><template #icon><AIcon type="PlusOutlined" /></template>新增区域</j-permission-button></template><template #card="slotProps"><CardBox :value="slotProps" :actions="getAreaActions(slotProps, 'card')" @click="openDetail(slotProps.id)"><template #img><Image :src="slotProps.photoUrl || defaultImage" class="card-list-img-80" /></template><template #content>
                <j-ellipsis style="width: calc(100% - 100px); margin-bottom: 18px">
                  <span class="card-title">{{ slotProps.name }}</span>
                </j-ellipsis>
                <a-row>
                  <a-col :span="12">
                    <div class="card-item-content-text">区域编号</div>
                    <div>{{ slotProps.code }}</div>
                  </a-col>
                  <a-col :span="12">
                    <div class="card-item-content-text">说明</div>
                    <j-ellipsis style="width: 100%">{{ slotProps.remark || '-' }}</j-ellipsis>
                  </a-col>
                </a-row>
              </template><template #actions="item"><j-permission-button type="link" :danger="item.key === 'delete'" :popConfirm="item.popConfirm" @click.stop="item.onClick"><AIcon :type="item.icon" /><span>{{ item.text }}</span></j-permission-button></template></CardBox></template><template #updatedAt="slotProps">{{ formatTime(slotProps.updateTime) }}</template><template #action="slotProps"><a-space :size="16"><template v-for="item in getAreaActions(slotProps, 'table')" :key="item.key"><j-permission-button type="link" style="padding: 0 5px" :danger="item.key === 'delete'" :popConfirm="item.popConfirm" @click="item.onClick"><template #icon><AIcon :type="item.icon" /></template></j-permission-button></template></a-space></template></j-pro-table></FullPage>
    <Save ref="saveRef" @success="reload" />
    <Detail ref="detailRef" />
  </j-page-container>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { device } from '@device-manager-ui/assets'
import { formatTime } from '../utils'
import { queryArea } from '../api/area'
import { deleteArea } from '../api/area'
import { getOverview } from '../api/dashboard'
import { useResourceStore } from '../useResourceStore'
import type { ActionItem } from '../types'
import Save from './Save.vue'
import Detail from './Detail.vue'
import TopCard from '../../DashBoard/components/TopCard.vue'

const store = useResourceStore()
const defaultImage = device.deviceProduct
const tableRef = ref()
const saveRef = ref()
const detailRef = ref()
const params = ref<Record<string, any>>({})
const overview = reactive({
  areaCount: 0, areaDeviceTotal: 0, workstationCount: 0, avgWorkstationsPerArea: 0,
  occupiedDeviceCount: 0, occupiedRate: 0, idleDeviceCount: 0, idleRate: 0,
  platformDeviceCount: 0, platformOnlineCount: 0, platformOfflineCount: 0
})
const deviceFooter = computed(() => [
  { title: '在线', value: overview.platformOnlineCount, status: 'success' as const },
  { title: '离线', value: overview.platformOfflineCount, status: 'default' as const }
])

const columns = [
  { title: '区域编号', dataIndex: 'code', key: 'code', search: { type: 'string', first: true }, ellipsis: true },
  { title: '区域名称', dataIndex: 'name', key: 'name', search: { type: 'string' }, ellipsis: true },
  { title: '说明', dataIndex: 'remark', key: 'remark', ellipsis: true },
  { title: '更新时间', dataIndex: 'updateTime', key: 'updatedAt', width: 180, scopedSlots: true },
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
const openDetail = (id: string) => detailRef.value?.open(id)
const reload = () => { tableRef.value?.reload(); loadOverview(); store.refreshAreaOptions() }

const getAreaActions = (record: any, _mode: 'card' | 'table'): ActionItem[] => [
  { key: 'view', text: '查看', icon: 'EyeOutlined', onClick: () => openDetail(record.id) },
  { key: 'edit', text: '编辑', icon: 'EditOutlined', onClick: () => saveRef.value?.open('edit', record.id) },
  { key: 'delete', text: '删除', icon: 'DeleteOutlined', onClick: () => undefined, popConfirm: { title: '确认删除该区域？', onConfirm: async () => { await deleteArea(record.id); reload() } } }
]

onMounted(() => { loadOverview() })
</script>

<style scoped lang="less">
.top-card { display: flex; flex-direction: column; padding: 24px; background-color: #fff; border: 1px solid #e0e4e8; border-radius: 2px; .top-card-content { display: flex; justify-content: space-between; flex-grow: 1; } .content-left-title { color: rgba(0, 0, 0, 0.64); } .content-left-value { padding: 12px 0; color: #323130; font-weight: 700; font-size: 36px; line-height: 1; } .content-right { width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 26px; background: linear-gradient(135deg, #4c95ff 0%, #2f54eb 100%); } .content-right.warning { background: linear-gradient(135deg, #ffb85c 0%, #fa8c16 100%); } .content-right.success { background: linear-gradient(135deg, #63e6be 0%, #13c2c2 100%); } .top-card-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 16px; border-top: 1px solid #f0f0f0; } .footer-item-value { color: #323130; font-weight: 700; font-size: 16px; } }
.card-title { font-size: 16px; font-weight: 600; }
.resource-card-desc { margin-top: 16px; color: rgba(0, 0, 0, 0.45); font-size: 12px; line-height: 20px; }
.card-item-content-text { color: rgba(0, 0, 0, 0.45); font-size: 12px; line-height: 20px; }
</style>
