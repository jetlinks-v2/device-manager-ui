<template>
  <div>
    <!-- 搜索条件 -->
    <pro-search
      :columns="searchColumns"
      target="workstation-devices-tab"
      @search="handleSearch"
      style="padding: 0"
      :saveButton="false"
    />

    <!-- 操作栏 -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px">
      <a-space>
        <a-button type="primary" @click="openBindModal">
          <template #icon><AIcon type="PlusOutlined" /></template>
          绑定设备
        </a-button>
        <span style="color: rgba(0,0,0,0.45); font-size: 13px">共 {{ total }} 台</span>
      </a-space>
    </div>

    <!-- 设备卡片列表 -->
    <a-spin :spinning="loading">
      <a-row :gutter="[16, 16]">
        <a-col v-for="item in deviceList" :key="item.id" :xs="24" :sm="12" :md="8" :lg="6">
          <CardBox
            :value="item"
            :actions="getDeviceActions(item)"
            :status="item.lockStatus"
            :statusText="item.lockStatusText"
            :statusNames="statusNames"
          >
            <template #img>
              <Image :src="item.photoUrl || defaultImage" class="card-list-img-80" />
            </template>
            <template #content>
              <j-ellipsis style="width: calc(100% - 100px); margin-bottom: 12px">
                <span class="card-title">{{ item.name }}</span>
              </j-ellipsis>
              <a-row>
                <a-col :span="12">
                  <div class="card-item-content-text">设备编号</div>
                  <div>{{ item.id }}</div>
                </a-col>
                <a-col :span="12">
                  <div class="card-item-content-text">产品类型</div>
                  <j-ellipsis style="width: 100%">{{ item.productName || '-' }}</j-ellipsis>
                </a-col>
              </a-row>
              <a-row style="margin-top: 8px">
                <a-col :span="24">
                  <div class="card-item-content-text">占用工位</div>
                  <j-ellipsis style="width: 100%">{{ item.occupiedByLabel }}</j-ellipsis>
                </a-col>
              </a-row>
            </template>
            <template #actions="action">
              <j-permission-button
                type="link"
                :danger="action.key === 'release' || action.key === 'unbind'"
                :disabled="action.disabled"
                :popConfirm="action.popConfirm"
                @click.stop="action.onClick"
              >
                <AIcon :type="action.icon" />
                <span>{{ action.text }}</span>
              </j-permission-button>
            </template>
          </CardBox>
        </a-col>
      </a-row>
      <a-empty v-if="!loading && !deviceList.length" description="暂无配套设备" />
    </a-spin>

    <!-- 分页 -->
    <div style="margin-top: 16px; display: flex; justify-content: flex-end">
      <a-pagination
        v-model:current="currentPage"
        :total="total"
        :page-size="pageSize"
        :show-total="(t: number) => `共 ${t} 台`"
        :show-size-changer="false"
        size="small"
        @change="handlePageChange"
      />
    </div>
  </div>

  <!-- 绑定设备弹窗 -->
  <a-modal
    v-model:open="bindVisible"
    title="绑定设备"
    width="980px"
    :confirmLoading="bindLoading"
    :maskClosable="false"
    destroy-on-close
    @ok="handleBindSubmit"
    @cancel="bindSelectedIds = []"
  >
    <pro-search
      :columns="bindSearchColumns"
      target="workstation-bind-device"
      @search="handleBindSearch"
      style="padding: 0"
      :saveButton="false"
    />
    <JProTable
      ref="bindTableRef"
      :columns="bindColumns"
      :request="queryBindDevices"
      mode="TABLE"
      :params="bindParams"
      :defaultParams="{ sorts: [{ name: 'createTime', order: 'desc' }] }"
      :rowSelection="{
        selectedRowKeys: bindSelectedIds,
        onSelect: onBindSelect,
        onSelectAll: onBindSelectAll,
        onSelectNone: () => { bindSelectedIds = [] }
      }"
      :bodyStyle="{ padding: 0 }"
    >
      <template #headerLeftRender>
        <span style="color: rgba(0,0,0,0.45); font-size: 12px">已勾选 {{ bindSelectedIds.length }} 台</span>
      </template>
    </JProTable>
  </a-modal>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { device } from '@device-manager-ui/assets'
import { queryWorkstationDevices, queryDeviceDetail, bindDevices, unbindDevices } from '../../api/workstation'
import { releaseLockById } from '../../api/deviceLock'

const props = defineProps<{ workstationId: string }>()
const emit = defineEmits(['refresh'])
const defaultImage = device.deviceCard
const loading = ref(false)
const deviceList = ref<any[]>([])
const currentPage = ref(1)
const pageSize = 8
const total = ref(0)
const searchParams = ref<Record<string, any>>({})

const statusNames = { idle: 'default', self: 'processing', other: 'warning' }

const searchColumns = [
  { title: '设备名称', dataIndex: 'name', key: 'name', search: { type: 'string', first: true } },
  { title: '设备编号', dataIndex: 'id', key: 'id', search: { type: 'string' } }
]

const loadDevices = async () => {
  loading.value = true
  try {
    const resp = await queryWorkstationDevices(props.workstationId, {
      pageIndex: currentPage.value - 1,
      pageSize,
      sorts: [{ name: 'createTime', order: 'desc' }],
      terms: searchParams.value.terms
    })
    const result = resp.result || {}
    const list = result.data || []
    total.value = result.total ?? list.length
    deviceList.value = list.map((d: any) => {
      const lock = d.lockInfo
      const isSelf = lock?.workstationId === props.workstationId
      return {
        ...d,
        lockStatus: !lock ? 'idle' : isSelf ? 'self' : 'other',
        lockStatusText: !lock ? '空闲' : isSelf ? '本工位占用' : '他工位占用',
        occupiedByLabel: !lock ? '无' : `${lock.workstationCode || lock.workstationId || ''}`,
        lockId: lock?.lockId || ''
      }
    })
  } catch {
    deviceList.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

const handleSearch = (val: Record<string, any>) => {
  searchParams.value = val
  currentPage.value = 1
  loadDevices()
}

const handlePageChange = (page: number) => { currentPage.value = page; loadDevices() }

const handleRelease = async (lockId: string) => {
  try {
    await releaseLockById(lockId)
    message.success('已解除占用')
    loadDevices()
  } catch { message.error('解除失败') }
}

const handleUnbind = async (deviceId: string) => {
  try {
    await unbindDevices(props.workstationId, [deviceId])
    message.success('已解绑设备')
    loadDevices()
    emit('refresh')
  } catch { message.error('解绑失败') }
}

const getDeviceActions = (item: any) => {
  const actions: any[] = []
  if (item.lockStatus === 'idle') {
    actions.push({
      key: 'unbind', text: '解绑', icon: 'DisconnectOutlined',
      onClick: () => undefined,
      popConfirm: { title: '确认解除该设备的绑定？', onConfirm: () => handleUnbind(item.id) }
    })
  } else if (item.lockStatus === 'self') {
    actions.push({
      key: 'release', text: '解除占用', icon: 'UnlockOutlined',
      onClick: () => undefined,
      popConfirm: { title: '确认解除该设备占用？', onConfirm: () => handleRelease(item.lockId) }
    })
  } else if (item.lockStatus === 'other') {
    actions.push({
      key: 'unbind', text: '解绑', icon: 'DisconnectOutlined',
      onClick: () => undefined,
      popConfirm: { title: '该设备正被他工位占用，确认解除绑定？', onConfirm: () => handleUnbind(item.id) }
    })
  }
  return actions
}

// ---- 绑定设备弹窗 ----
const bindVisible = ref(false)
const bindLoading = ref(false)
const bindTableRef = ref()
const bindSelectedIds = ref<string[]>([])
const bindParams = ref<Record<string, any>>({})

const bindSearchColumns = [
  { title: '设备名称', dataIndex: 'name', key: 'name', search: { type: 'string', first: true } },
  { title: '设备ID', dataIndex: 'id', key: 'id', search: { type: 'string', defaultTermType: 'eq' } }
]

const bindColumns = [
  { title: '设备名称', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '设备ID', dataIndex: 'id', key: 'id', ellipsis: true },
  { title: '所属产品', dataIndex: 'productName', key: 'productName', ellipsis: true, width: 160 }
]

const queryBindDevices = (data: Record<string, any>) => {
  const { terms = [], ...rest } = data
  return queryDeviceDetail({
    ...rest,
    terms: [
      ...terms,
      {
        column: 'id',
        termType: 'resource-ws-bind',
        value: [{ column: 'workstationId', termType: 'eq', value: props.workstationId }],
        options: ['not']
      }
    ]
  })
}

const handleBindSearch = (params: Record<string, any>) => { bindParams.value = params; bindSelectedIds.value = [] }

const onBindSelect = (item: any, selected: boolean) => {
  const set = new Set(bindSelectedIds.value)
  selected ? set.add(item.id) : set.delete(item.id)
  bindSelectedIds.value = [...set]
}

const onBindSelectAll = (selected: boolean, _: any, changeRows: any[]) => {
  const set = new Set(bindSelectedIds.value)
  changeRows.forEach((item) => selected ? set.add(item.id) : set.delete(item.id))
  bindSelectedIds.value = [...set]
}

const openBindModal = () => {
  bindSelectedIds.value = []
  bindParams.value = {}
  bindVisible.value = true
}

const handleBindSubmit = async () => {
  if (!bindSelectedIds.value.length) { message.warning('请选择要绑定的设备'); return }
  bindLoading.value = true
  try {
    await bindDevices(props.workstationId, bindSelectedIds.value)
    message.success(`已绑定 ${bindSelectedIds.value.length} 台设备`)
    bindVisible.value = false
    bindSelectedIds.value = []
    loadDevices()
    emit('refresh')
  } catch { message.error('绑定失败') } finally { bindLoading.value = false }
}

watch(() => props.workstationId, () => { currentPage.value = 1; searchParams.value = {}; loadDevices() })
onMounted(() => { loadDevices() })
</script>

<style scoped lang="less">
.card-title { font-size: 16px; font-weight: 600; }
.card-item-content-text { color: rgba(0, 0, 0, 0.45); font-size: 12px; line-height: 20px; }
</style>
