<template>
  <pro-search
    :columns="searchColumns"
    target="workstation-occupancy"
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
    :rowSelection="{ selectedRowKeys, onChange: onSelectChange }"
  >
    <template #headerLeftRender>
      <a-space>
        <a-button type="primary" @click="applyVisible = true">
          <template #icon><AIcon type="PlusOutlined" /></template>
          申请占用
        </a-button>
        <a-popconfirm
          v-if="selectedRowKeys.length"
          :title="`确认批量解除 ${selectedRowKeys.length} 条占用？`"
          ok-text="确认" cancel-text="取消"
          @confirm="handleBatchRelease"
        >
          <a-button danger>
            <template #icon><AIcon type="DisconnectOutlined" /></template>
            批量解除（{{ selectedRowKeys.length }}）
          </a-button>
        </a-popconfirm>
      </a-space>
    </template>
    <template #deviceName="slotProps">
      <j-ellipsis style="width: calc(100% - 20px)">{{ slotProps.deviceName }}</j-ellipsis>
    </template>
    <template #createdAt="slotProps">{{ formatTime(slotProps.createTime) }}</template>
    <template #action="slotProps">
      <a-popconfirm title="确认解除该设备的占用？" ok-text="确认" cancel-text="取消" @confirm="handleRelease(slotProps.id)">
        <j-permission-button type="link" danger style="padding: 0">
          <template #icon><AIcon type="DisconnectOutlined" /></template>
        </j-permission-button>
      </a-popconfirm>
    </template>
  </JProTable>

  <!-- 申请占用弹窗 -->
  <a-modal v-model:open="applyVisible" title="申请占用" :maskClosable="false" destroy-on-close width="720px" :confirmLoading="applyLoading" @ok="handleApplySubmit">
    <a-form layout="vertical">
      <a-form-item label="工位">
        <a-input :value="workstationLabel" disabled />
      </a-form-item>
      <a-form-item label="占用设备" required>
        <a-select
          v-model:value="applyForm.deviceIds"
          mode="multiple"
          show-search
          :filter-option="selectFilterOption"
          option-filter-prop="label"
          :options="availableDeviceOptions"
          :loading="deviceOptionsLoading"
          placeholder="选择未被占用的设备"
          @focus="loadAvailableDevices"
        />
      </a-form-item>
      <a-form-item label="用途说明">
        <a-textarea v-model:value="applyForm.reason" :rows="3" placeholder="例如：耐久测试批次A" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { formatTime, selectFilterOption } from '../../utils'
import { queryLock, releaseLockById, batchReleaseLock, applyLock } from '../../api/deviceLock'
import { queryWorkstationFreeDevices } from '../../api/workstation'
import { useResourceStore } from '../../useResourceStore'

const props = defineProps<{ workstationId: string }>()
const store = useResourceStore()
const tableRef = ref()
const params = ref<Record<string, any>>({})
const selectedRowKeys = ref<string[]>([])
const applyVisible = ref(false)
const applyLoading = ref(false)
const deviceOptionsLoading = ref(false)
const availableDeviceOptions = ref<Array<{ label: string; value: string }>>([])
const applyForm = reactive({ deviceIds: [] as string[], reason: '' })

const workstationLabel = `${store.getWorkstationCode(props.workstationId)}｜${store.getWorkstationName(props.workstationId)}`

const searchColumns = [
  { title: '设备名称', dataIndex: 'deviceName', key: 'deviceName', search: { type: 'string', first: true } },
  { title: '设备ID', dataIndex: 'deviceId', key: 'deviceId', search: { type: 'string', defaultTermType: 'eq' } }
]
const columns = [
  { title: '设备编号', dataIndex: 'deviceCode', key: 'deviceCode', width: 140 },
  { title: '设备名称', dataIndex: 'deviceName', key: 'deviceName', scopedSlots: true, ellipsis: true },
  { title: '用途', dataIndex: 'reason', key: 'reason', ellipsis: true },
  { title: '申请时间', dataIndex: 'createTime', key: 'createdAt', width: 180, scopedSlots: true },
  { title: '操作', key: 'action', width: 80, fixed: 'right', scopedSlots: true }
]

const queryList = (reqParams: Record<string, any>) => {
  const rawTerms = reqParams.terms || []
  const terms: any[] = []
  // deviceName 需要转成 resource-lock-device 嵌套 term
  rawTerms.forEach((termGroup: any) => {
    const innerTerms = termGroup.terms || [termGroup]
    const converted = innerTerms.map((t: any) => {
      if (t.column === 'deviceName') {
        return {
          column: 'deviceId',
          termType: 'resource-lock-device',
          value: [{ column: 'name', termType: t.termType, value: t.value }]
        }
      }
      return t
    })
    terms.push(termGroup.terms ? { ...termGroup, terms: converted } : converted[0])
  })
  terms.push({ column: 'workstationId', termType: 'eq', value: props.workstationId })
  return queryLock({ ...reqParams, terms })
}

const onSelectChange = (keys: string[]) => { selectedRowKeys.value = keys }
const handleSearch = (val: Record<string, any>) => { params.value = val }
const reload = () => { tableRef.value?.reload(); selectedRowKeys.value = [] }

const handleRelease = async (lockId: string) => {
  try {
    await releaseLockById(lockId)
    message.success('已解除占用')
    reload()
  } catch { message.error('解除失败') }
}

const handleBatchRelease = async () => {
  try {
    await batchReleaseLock({ lockIds: selectedRowKeys.value })
    message.success(`已批量解除 ${selectedRowKeys.value.length} 条占用`)
    reload()
  } catch { message.error('批量解除失败') }
}

const loadAvailableDevices = async () => {
  deviceOptionsLoading.value = true
  try {
    const resp = await queryWorkstationFreeDevices(props.workstationId, { pageIndex: 0, pageSize: 200 })
    const devices = resp.result?.data || []
    availableDeviceOptions.value = devices
      .map((d: any) => ({ label: `${d.code || d.id}｜${d.name || d.id}`, value: d.id }))
  } catch { /* ignore */ } finally { deviceOptionsLoading.value = false }
}

const handleApplySubmit = async () => {
  if (!applyForm.deviceIds.length) { message.warning('请选择设备'); return }
  applyLoading.value = true
  try {
    await applyLock({ workstationId: props.workstationId, deviceIds: applyForm.deviceIds, reason: applyForm.reason })
    message.success('申请占用成功')
    applyVisible.value = false
    applyForm.deviceIds = []
    applyForm.reason = ''
    reload()
  } catch (e: any) { message.error(e?.message || '申请失败') } finally { applyLoading.value = false }
}
</script>
